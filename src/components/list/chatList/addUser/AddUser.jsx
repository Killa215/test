import './addUser.css'
import { db } from '../../../../lib/firebase'
import {
	arrayUnion,
	collection,
	doc,
	getDocs,
	serverTimestamp,
	setDoc,
	updateDoc,
	getDoc,
} from 'firebase/firestore'
import { useState, useEffect } from 'react'
import { useUserStore } from '../../../../lib/userStore'
import { debounce } from 'lodash'
import { FaTimes } from 'react-icons/fa'

const AddUser = ({ onClose }) => {
	const [users, setUsers] = useState([])
	const [error, setError] = useState(null)
	const [searchQuery, setSearchQuery] = useState('')
	const [isLoading, setIsLoading] = useState(false)

	const { currentUser } = useUserStore()

	const searchUsers = debounce(async query => {
		if (query.trim() === '') {
			setUsers([])
			return
		}

		setIsLoading(true)
		setError(null)

		try {
			const userRef = collection(db, 'user')
			const querySnapshot = await getDocs(userRef)

			const foundUsers = querySnapshot.docs
				.map(doc => doc.data())
				.filter(
					user =>
						user.username.toLowerCase().includes(query.toLowerCase()) &&
						user.id !== currentUser.id
				)

			setUsers(foundUsers)
			if (foundUsers.length === 0) {
				setError('Пользователи не найдены')
			}
		} catch (err) {
			console.error(err)
			setError('Ошибка при поиске пользователей')
		} finally {
			setIsLoading(false)
		}
	}, 300)

	useEffect(() => {
		searchUsers(searchQuery)
		return () => searchUsers.cancel()
	}, [searchQuery])

	const handleAdd = async userToAdd => {
		const chatRef = collection(db, 'chats')
		const userChatsRef = collection(db, 'userchats')

		try {
			const currentUserChatsRef = doc(userChatsRef, currentUser.id)
			const currentUserChatsSnap = await getDoc(currentUserChatsRef)

			if (currentUserChatsSnap.exists()) {
				const chats = currentUserChatsSnap.data().chats || []
				const existingChat = chats.find(
					chat => chat.receiverId === userToAdd.id
				)

				if (existingChat) {
					setError('Чат с этим пользователем уже существует')
					return
				}
			}

			const newChatRef = doc(chatRef)
			await setDoc(newChatRef, {
				createdAt: serverTimestamp(),
				messages: [],
			})

			await Promise.all([
				updateDoc(doc(userChatsRef, userToAdd.id), {
					chats: arrayUnion({
						chatId: newChatRef.id,
						lastMessage: '',
						receiverId: currentUser.id,
						updatedAt: Date.now(),
					}),
				}),
				updateDoc(doc(userChatsRef, currentUser.id), {
					chats: arrayUnion({
						chatId: newChatRef.id,
						lastMessage: '',
						receiverId: userToAdd.id,
						updatedAt: Date.now(),
					}),
				}),
			])

			setUsers(prev => prev.filter(u => u.id !== userToAdd.id))
			setError(null)
		} catch (err) {
			console.error(err)
			setError('Ошибка при создании чата')
		}
	}

	return (
		<div className='addUser'>
			<button className='close-btn' onClick={onClose}>
				<FaTimes />
			</button>

			<div className='search-container'>
				<input
					type='text'
					placeholder='Поиск пользователей...'
					value={searchQuery}
					onChange={e => setSearchQuery(e.target.value)}
					autoFocus
				/>
				{isLoading && <div className='spinner'></div>}
			</div>

			{error && <div className='error'>{error}</div>}

			<div className='user-list'>
				{users.map(user => (
					<div className='user' key={user.id}>
						<div className='detail'>
							<img
								src={user.avatar || '../../../../../public/avatar.png'}
								alt={user.username}
							/>
							<span>{user.username}</span>
						</div>
						<button onClick={() => handleAdd(user)}>Добавить</button>
					</div>
				))}
			</div>
		</div>
	)
}

export default AddUser
