import { useState, useEffect } from 'react'
import './Group.css'
import { db } from '../../../../lib/firebase'
import {
	arrayUnion,
	collection,
	doc,
	getDoc,
	getDocs,
	query,
	serverTimestamp,
	setDoc,
	updateDoc,
	where,
} from 'firebase/firestore'
import { useUserStore } from '../../../../lib/userStore'
import { useChatStore } from '../../../../lib/chatStore'

const USERS_COLLECTION_NAME = 'user'

const AddGroup = ({ onClose }) => {
	const [groupName, setGroupName] = useState('')
	const [searchInput, setSearchInput] = useState('')
	const [users, setUsers] = useState([])
	const [loading, setLoading] = useState(true)
	const [searchResults, setSearchResults] = useState([])
	const [searchLoading, setSearchLoading] = useState(false)
	const [selectedUsers, setSelectedUsers] = useState([])

	const { currentUser } = useUserStore()
	const { changeChat } = useChatStore()

	useEffect(() => {
		const fetchUsersFromChats = async () => {
			if (!currentUser?.id) return

			setLoading(true)
			try {
				const userChatsRef = doc(db, 'userchats', currentUser.id)
				const userChatsSnap = await getDoc(userChatsRef)

				if (!userChatsSnap.exists()) {
					setUsers([])
					return
				}

				const chats = userChatsSnap.data().chats
				const userIds = new Set()

				chats.forEach(chat => {
					if (chat.isGroup) {
						if (chat.group && chat.group.members) {
							chat.group.members.forEach(memberId => {
								if (memberId !== currentUser.id) userIds.add(memberId)
							})
						}
					} else {
						if (chat.receiverId && chat.receiverId !== currentUser.id) {
							userIds.add(chat.receiverId)
						}
					}
				})

				const usersPromises = Array.from(userIds).map(async userId => {
					const userDocRef = doc(db, USERS_COLLECTION_NAME, userId)
					const userDocSnap = await getDoc(userDocRef)
					return userDocSnap.exists()
						? { id: userId, ...userDocSnap.data() }
						: null
				})

				const usersData = (await Promise.all(usersPromises)).filter(Boolean)
				setUsers(usersData)
			} catch (err) {
				console.error('Error fetching users from chats:', err)
			} finally {
				setLoading(false)
			}
		}

		fetchUsersFromChats()
	}, [currentUser.id])

	const handleSearch = async e => {
		e.preventDefault()
		const formData = new FormData(e.target)
		let usernameToFind = formData.get('username')

		if (!usernameToFind || usernameToFind.trim() === '') {
			setSearchResults([])
			return
		}

		usernameToFind = usernameToFind.trim()
		setSearchLoading(true)
		setSearchResults([])

		try {
			const usersCollectionRef = collection(db, USERS_COLLECTION_NAME)
			const q = query(
				usersCollectionRef,
				where('username', '==', usernameToFind)
			)

			const querySnapshot = await getDocs(q)
			const foundUsers = []

			if (!querySnapshot.empty) {
				querySnapshot.forEach(doc => {
					const userData = doc.data()
					foundUsers.push({ id: doc.id, ...userData })
				})
			}

			const filteredResults = foundUsers.filter(
				user =>
					user.id !== currentUser.id &&
					!selectedUsers.some(u => u.id === user.id) &&
					!users.some(u => u.id === user.id)
			)

			setSearchResults(filteredResults)
		} catch (err) {
			console.error('Search error:', err)
			setSearchResults([])
		} finally {
			setSearchLoading(false)
		}
	}

	const handleAddUser = user => {
		if (!selectedUsers.some(u => u.id === user.id)) {
			setSelectedUsers([...selectedUsers, user])
			setSearchInput('')
			setSearchResults([])
		}
	}

	const handleRemoveUser = userId => {
		setSelectedUsers(selectedUsers.filter(user => user.id !== userId))
	}

	const handleCreateGroup = async () => {
		if (!groupName.trim() || selectedUsers.length === 0) return

		const chatsRef = collection(db, 'chats')
		const userChatsRef = collection(db, 'userchats')
		const memberIds = selectedUsers.map(user => user.id)

		try {
			const newChatRef = doc(chatsRef)

			const groupData = {
				name: groupName.trim(),
				admin: currentUser.id,
				members: [currentUser.id, ...memberIds],
				createdAt: serverTimestamp(),
				avatar: '',
			}

			await setDoc(newChatRef, {
				createdAt: serverTimestamp(),
				messages: [],
				isGroup: true,
				group: groupData,
			})

			const allMembers = [currentUser.id, ...memberIds]

			const chatDataForMembers = {
				chatId: newChatRef.id,
				lastMessage: '',
				isGroup: true,
				group: {
					name: groupData.name,
					avatar: groupData.avatar,
					admin: groupData.admin,
				},
				updatedAt: Date.now(),
				isSeen: false,
			}

			const updatePromises = allMembers.map(async userId => {
				const userChatDocRef = doc(userChatsRef, userId)
				const userChatDocSnap = await getDoc(userChatDocRef)

				if (userChatDocSnap.exists()) {
					await updateDoc(userChatDocRef, {
						chats: arrayUnion(chatDataForMembers),
					})
				} else {
					await setDoc(userChatDocRef, {
						chats: [chatDataForMembers],
					})
				}
			})

			await Promise.all(updatePromises)

			changeChat(newChatRef.id, {
				id: newChatRef.id,
				isGroup: true,
				group: groupData,
				user: {
					id: newChatRef.id,
					username: groupData.name,
					avatar: groupData.avatar || '../../../../public/avatar.png',
					isGroup: true,
				},
			})

			onClose()
		} catch (err) {
			console.error('Ошибка создания группы:', err)
		}
	}

	const filteredUsers = users.filter(
		user =>
			user.username.toLowerCase().includes(searchInput.toLowerCase()) &&
			user.id !== currentUser.id &&
			!selectedUsers.some(u => u.id === user.id)
	)

	return (
		<div className='addGroup'>
			<div className='header'>
				<h3>Создать групповой чат</h3>
				<button className='closeBtn' onClick={onClose}>
					×
				</button>
			</div>

			<div className='groupInput'>
				<label>Название группы</label>
				<input
					type='text'
					placeholder='Введите название группы'
					value={groupName}
					onChange={e => setGroupName(e.target.value)}
					maxLength={30}
				/>
			</div>

			<div className='searchSection'>
				<form onSubmit={handleSearch}>
					<input
						type='text'
						placeholder='Поиск пользователей по точному имени'
						value={searchInput}
						onChange={e => setSearchInput(e.target.value)}
						name='username'
					/>
					<button type='submit' disabled={searchLoading}>
						{searchLoading ? 'Поиск...' : 'Найти'}
					</button>
				</form>

				{searchLoading && <div className='loadingIndicator'>Поиск...</div>}

				{!searchLoading && searchResults.length > 0 && (
					<div className='searchResults'>
						<h4>Результаты поиска:</h4>
						{searchResults.map(user => (
							<div key={user.id} className='userItem'>
								<img
									src={user.avatar || '../../../../public/avatar.png'}
									alt={user.username}
								/>
								<span>{user.username}</span>
								<button onClick={() => handleAddUser(user)}>Добавить</button>
							</div>
						))}
					</div>
				)}
			</div>

			<div className='userListSection'>
				{loading ? (
					<div className='loadingIndicator'>Загрузка контактов...</div>
				) : filteredUsers.length === 0 ? (
					<div className='emptyState'>Нет контактов для добавления</div>
				) : (
					<>
						<h4>Ваши контакты:</h4>
						<div className='contactsList'>
							{filteredUsers.map(user => (
								<div
									key={user.id}
									className='userItem'
									onClick={() => handleAddUser(user)}
								>
									<img
										src={user.avatar || '../../../../public/avatar.png'}
										alt={user.username}
									/>
									<span>{user.username}</span>
								</div>
							))}
						</div>
					</>
				)}
			</div>

			<div className='membersSection'>
				<h4>Участники ({selectedUsers.length + 1})</h4>
				<div className='membersList'>
					<div className='memberItem current'>
						<img
							src={currentUser.avatar || '../../../../public/avatar.png'}
							alt={currentUser.username}
						/>
						<span>{currentUser.username} (Вы)</span>
					</div>

					{selectedUsers.map(user => (
						<div key={user.id} className='memberItem'>
							<img
								src={user.avatar || '../../../../public/avatar.png'}
								alt={user.username}
							/>
							<span>{user.username}</span>
							<button
								className='removeBtn'
								onClick={() => handleRemoveUser(user.id)}
							>
								×
							</button>
						</div>
					))}
				</div>
			</div>

			<div className='actionButtons'>
				<button className='cancelButton' onClick={onClose}>
					Отмена
				</button>
				<button
					className='createButton'
					onClick={handleCreateGroup}
					disabled={!groupName.trim() || selectedUsers.length === 0}
				>
					Создать группу
				</button>
			</div>
		</div>
	)
}

export default AddGroup
