/* eslint-disable no-mixed-spaces-and-tabs */
import { useEffect, useState } from 'react'
import './chatList.css'
import AddUser from './addUser/AddUser'
import GroupChatModal from './groupChat/GroupChatModal'
import { useUserStore } from '../../../lib/userStore'
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { useChatStore } from '../../../lib/chatStore'

const ChatList = () => {
	const [chats, setChats] = useState([])
	const [addMode, setAddMode] = useState(false)
	const [groupMode, setGroupMode] = useState(false)
	const [input, setInput] = useState('')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)

	const { currentUser } = useUserStore()
	const { chatId, changeChat } = useChatStore()

	useEffect(() => {
		if (!currentUser?.id) return

		const unSub = onSnapshot(
			doc(db, 'userchats', currentUser.id),
			async res => {
				try {
					if (!res.exists()) {
						setChats([])
						return
					}

					const items = res.data()?.chats || []

					const promises = items.map(async item => {
						try {
							// Для групповых чатов
							if (item.isGroup) {
								// Получаем актуальные данные чата
								const chatDoc = await getDoc(doc(db, 'chats', item.chatId))
								const chatData = chatDoc.data()

								return {
									...item,
									user: {
										id: item.chatId,
										username:
											chatData?.chatName || item.group?.name || 'Групповой чат',
										avatar:
											chatData?.chatAvatar ||
											item.group?.avatar ||
											'/avatar.png',
										isGroup: true,
									},
									lastMessage: item.lastMessage || 'Нет сообщений',
								}
							}

							// Для обычных чатов
							const userDocRef = doc(db, 'user', item.receiverId)
							const userDocSnap = await getDoc(userDocRef)

							const user = userDocSnap.data()

							return {
								...item,
								user: user || {
									blocked: [],
									username: 'Удалённый пользователь',
									avatar: '/avatar.png',
									id: item.receiverId,
								},
								lastMessage: item.lastMessage || 'Нет сообщений',
							}
						} catch (err) {
							console.error('Ошибка загрузки пользователя:', err)
							return {
								...item,
								user: {
									blocked: [],
									username: item.isGroup ? 'Групповой чат' : 'Ошибка загрузки',
									avatar: '/avatar.png',
									id: item.isGroup ? item.chatId : item.receiverId,
									isGroup: item.isGroup,
								},
								lastMessage: item.lastMessage || 'Нет сообщений',
							}
						}
					})

					const chatData = await Promise.all(promises)
					setChats(
						chatData.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
					)
					setError(null)
				} catch (err) {
					console.error('Ошибка загрузки чатов:', err)
					setError('Не удалось загрузить чаты')
					setChats([])
				} finally {
					setLoading(false)
				}
			},
			err => {
				console.error('Ошибка подписки на чаты:', err)
				setError('Ошибка подключения')
				setLoading(false)
			}
		)

		return () => unSub()
	}, [currentUser?.id])

	const handleSelect = async chat => {
		if (!chat?.chatId || !currentUser?.id) return

		try {
			const userChats = chats.map(item => {
				const { user, ...rest } = item
				return rest
			})

			const chatIndex = userChats.findIndex(item => item.chatId === chat.chatId)
			if (chatIndex === -1) return

			userChats[chatIndex].isSeen = true

			await updateDoc(doc(db, 'userchats', currentUser.id), {
				chats: userChats,
			})

			changeChat(chat.chatId, chat.user)
		} catch (err) {
			console.error('Ошибка обновления чата:', err)
		}
	}

	const filteredChats = chats.filter(c =>
		c.user?.username?.toLowerCase().includes(input.toLowerCase())
	)

	if (loading) {
		return <div className='chatList'>Загрузка чатов...</div>
	}

	if (error) {
		return <div className='chatList error'>{error}</div>
	}

	return (
		<div className='chatList'>
			<div className='search'>
				<div className='searchBar'>
					<img src='/search.png' alt='Поиск' />
					<input
						type='text'
						placeholder='Поиск'
						onChange={e => setInput(e.target.value)}
					/>
				</div>
				<img
					src='/PeopleGroup.svg'
					alt='Группы'
					className='group'
					onClick={() => setGroupMode(true)}
				/>
				<img
					src={addMode ? '/minus.png' : '/plus.png'}
					alt='Добавить'
					className='add'
					onClick={() => setAddMode(prev => !prev)}
				/>
			</div>

			{filteredChats.length === 0 ? (
				<div className='no-chats'>Нет чатов</div>
			) : (
				filteredChats.map(chat => (
					<div
						className='item'
						key={chat.chatId}
						onClick={() => handleSelect(chat)}
						style={{
							backgroundColor: chat?.isSeen ? 'transparent' : '#434f2a',
							opacity: chat.user?.blocked?.includes(currentUser?.id) ? 0.6 : 1,
						}}
					>
						{chat.user?.isGroup && <span className='group-badge'>Группа</span>}
						<img
							src={
								chat.user?.blocked?.includes(currentUser?.id)
									? '/avatar.png'
									: chat.user?.avatar || '/avatar.png'
							}
							alt='Аватар'
							onError={e => {
								e.target.src = '/avatar.png'
							}}
							key={chat.user?.avatar}
						/>
						<div className='texts'>
							<span>
								{!chat.user
									? 'Удалённый пользователь'
									: chat.user.blocked?.includes(currentUser?.id)
									? chat.user.isGroup
										? 'Групповой чат'
										: 'Пользователь'
									: chat.user.username ||
									  (chat.user.isGroup ? 'Групповой чат' : 'Без имени')}
							</span>
							<p>{chat.lastMessage || 'Нет сообщений'}</p>
						</div>
					</div>
				))
			)}

			{addMode && <AddUser onClose={() => setAddMode(false)} />}
			{groupMode && <GroupChatModal onClose={() => setGroupMode(false)} />}
		</div>
	)
}

export default ChatList
