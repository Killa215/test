import { useState, useRef, useEffect } from 'react'
import './userInfo.css'
import { useUserStore } from '../../../lib/userStore'
import { doc, updateDoc } from 'firebase/firestore'
import { db, storage } from '../../../lib/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { toast } from 'react-toastify'
import { auth } from '../../../lib/firebase'
import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'

const UserInfo = () => {
	const { currentUser, setCurrentUser } = useUserStore()
	const [isEditing, setIsEditing] = useState(false)
	const [newUsername, setNewUsername] = useState(currentUser?.username || '')
	const [newAvatar, setNewAvatar] = useState(null)
	const [avatarPreview, setAvatarPreview] = useState(currentUser?.avatar || '')
	const [showDropdown, setShowDropdown] = useState(false)
	const fileInputRef = useRef(null)
	const dropdownRef = useRef(null)
	const navigate = useNavigate()

	const handleEditClick = () => {
		setIsEditing(true)
		setNewUsername(currentUser?.username || '')
		setAvatarPreview(currentUser?.avatar || '')
		setShowDropdown(false) // Закрываем dropdown при редактировании
	}

	const handleAvatarChange = e => {
		const file = e.target.files[0]
		if (file) {
			setNewAvatar(file)
			setAvatarPreview(URL.createObjectURL(file))
		}
	}

	const handleSave = async () => {
		if (!currentUser?.id) return

		try {
			let avatarUrl = currentUser.avatar

			if (newAvatar) {
				const storageRef = ref(storage, `avatars/${currentUser.id}`)
				await uploadBytes(storageRef, newAvatar)
				avatarUrl = await getDownloadURL(storageRef)
			}

			const userDocRef = doc(db, 'user', currentUser.id)
			await updateDoc(userDocRef, {
				username: newUsername,
				avatar: avatarUrl,
			})

			setCurrentUser({
				...currentUser,
				username: newUsername,
				avatar: avatarUrl,
			})

			toast.success('Данные успешно обновлены!')
			setIsEditing(false)
		} catch (error) {
			console.error('Ошибка при обновлении данных:', error)
			toast.error('Не удалось обновить данные')
		}
	}

	const handleCancel = () => {
		setIsEditing(false)
		setAvatarPreview(currentUser?.avatar || '')
		setNewAvatar(null)
	}

	const handleLogout = async () => {
		try {
			await signOut(auth)
			setCurrentUser(null)
			navigate('/login')
			toast.success('Вы успешно вышли из аккаунта')
		} catch (error) {
			console.error('Ошибка при выходе:', error)
			toast.error('Не удалось выйти из аккаунта')
		}
	}

	const toggleDropdown = e => {
		e.stopPropagation()
		setShowDropdown(!showDropdown)
	}

	// Закрываем dropdown при клике вне его
	useEffect(() => {
		const handleClickOutside = e => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
				setShowDropdown(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [])

	if (!currentUser) return null

	return (
		<div className='userInfo'>
			{isEditing ? (
				<div className='edit-form'>
					<div className='avatar-edit'>
						<img
							src={avatarPreview || '../../../../public/avatar.png'}
							alt='Аватар'
							onClick={() => fileInputRef.current.click()}
							style={{ cursor: 'pointer' }}
						/>
						<input
							type='file'
							ref={fileInputRef}
							style={{ display: 'none' }}
							onChange={handleAvatarChange}
							accept='image/*'
						/>
						<p>Нажмите на аватар для изменения</p>
					</div>
					<input
						type='text'
						value={newUsername}
						onChange={e => setNewUsername(e.target.value)}
						className='username-input'
					/>
					<div className='edit-buttons'>
						<button onClick={handleSave} className='save-button'>
							Сохранить
						</button>
						<button onClick={handleCancel} className='cancel-button'>
							Отмена
						</button>
					</div>
				</div>
			) : (
				<>
					<div className='user'>
						<img
							src={currentUser.avatar || '../../../../public/avatar.png'}
							alt='Аватар'
						/>
						<h2>{currentUser.username}</h2>
					</div>
					<div className='icons' ref={dropdownRef}>
						<img
							src='../../../../public/more.png'
							alt='Меню'
							onClick={toggleDropdown}
							style={{ cursor: 'pointer' }}
						/>
						{showDropdown && (
							<div className='dropdown-menu'>
								<button onClick={handleLogout} className='dropdown-item'>
									Выйти
								</button>
							</div>
						)}
						<img
							src='../../../../public/edit.png'
							alt='Редактировать'
							onClick={handleEditClick}
							style={{ cursor: 'pointer' }}
						/>
					</div>
				</>
			)}
		</div>
	)
}

export default UserInfo
