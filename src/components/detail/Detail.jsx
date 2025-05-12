/* eslint-disable no-mixed-spaces-and-tabs */
import {
	arrayRemove,
	arrayUnion,
	doc,
	updateDoc,
	onSnapshot,
	getDoc,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { useChatStore } from '../../lib/chatStore'
import { auth, db, storage } from '../../lib/firebase'
import { useUserStore } from '../../lib/userStore'
import { ref, getDownloadURL } from 'firebase/storage'
import './detail.css'

const Detail = () => {
	const {
		chatId,
		user,
		isCurrentUserBlocked,
		isReceivedBlocked,
		changeBlock,
		resetChat,
	} = useChatStore()
	const { currentUser } = useUserStore()
	const [photos, setPhotos] = useState([])
	const [files, setFiles] = useState([])
	const [audioMessages, setAudioMessages] = useState([])
	const [activeTab, setActiveTab] = useState('photos')

	// Функция для сокращения имени файла
	const shortenFileName = name => {
		if (name.length <= 30) return name
		const extension = name.split('.').pop()
		const baseName = name.substring(0, name.lastIndexOf('.'))
		const shortenedBase = baseName.substring(0, 26 - extension.length)
		return `${shortenedBase}...${extension}`
	}

	useEffect(() => {
		const unsubscribe = onSnapshot(doc(db, 'chats', chatId), chatDoc => {
			if (chatDoc.exists()) {
				const messages = chatDoc.data().messages || []

				// Фильтруем медиафайлы
				const mediaMessages = messages.filter(
					message => message.media || message.img
				)

				// Обрабатываем фото (включая старые сообщения с полем img)
				const newPhotos = mediaMessages
					.filter(message => message.mediaType === 'image' || message.img)
					.map(message => ({
						url: message.media || message.img,
						name: shortenFileName(
							message.media
								? message.media.split('%2F').pop().split('?')[0] ||
										`photo_${Date.now()}.jpg`
								: message.img.split('%2F').pop().split('?')[0] ||
										`photo_${Date.now()}.jpg`
						),
						originalName: message.media
							? message.media.split('%2F').pop().split('?')[0] ||
							  `photo_${Date.now()}.jpg`
							: message.img.split('%2F').pop().split('?')[0] ||
							  `photo_${Date.now()}.jpg`,
						createdAt: message.createdAt?.toDate() || new Date(),
						type: 'image',
					}))

				// Обрабатываем файлы (документы и другие типы)
				const newFiles = mediaMessages
					.filter(
						message =>
							message.mediaType === 'document' ||
							(message.mediaType &&
								!['image', 'video', 'audio'].includes(message.mediaType))
					)
					.map(message => ({
						url: message.media,
						name: shortenFileName(
							message.media.split('%2F').pop().split('?')[0] ||
								`file_${Date.now()}`
						),
						originalName:
							message.media.split('%2F').pop().split('?')[0] ||
							`file_${Date.now()}`,
						createdAt: message.createdAt?.toDate() || new Date(),
						type: 'document',
					}))

				// Обрабатываем голосовые сообщения
				const newAudioMessages = mediaMessages
					.filter(message => message.mediaType === 'audio')
					.map(message => ({
						url: message.media,
						name: `Голосовое сообщение ${new Date(
							message.createdAt?.toDate() || new Date()
						).toLocaleString()}`,
						createdAt: message.createdAt?.toDate() || new Date(),
						type: 'audio',
						senderId: message.senderId,
					}))

				setPhotos(newPhotos)
				setFiles(newFiles)
				setAudioMessages(newAudioMessages)
			}
		})

		return () => unsubscribe()
	}, [chatId])

	const handleBlock = async () => {
		if (!user) return

		const userDocRef = doc(db, 'user', currentUser.id)

		try {
			await updateDoc(userDocRef, {
				blocked: isReceivedBlocked ? arrayRemove(user.id) : arrayUnion(user.id),
			})
			changeBlock()
		} catch (err) {
			console.error('Ошибка при блокировке/разблокировке пользователя:', err)
		}
	}

	const handleLeaveChat = async () => {
		if (!currentUser?.id || !chatId) return

		try {
			// Удаляем чат из userchats текущего пользователя
			const userChatsRef = doc(db, 'userchats', currentUser.id)
			const userChatsSnap = await getDoc(userChatsRef)

			if (userChatsSnap.exists()) {
				const currentChats = userChatsSnap.data().chats || []
				const updatedChats = currentChats.filter(chat => chat.chatId !== chatId)

				await updateDoc(userChatsRef, {
					chats: updatedChats,
				})
			}

			// Сбрасываем текущий чат в хранилище
			resetChat()
		} catch (err) {
			console.error('Ошибка при выходе из чата:', err)
		}
	}

	const downloadFile = async (fileUrl, originalName) => {
		try {
			let downloadUrl = fileUrl

			// Если это ссылка на Firebase Storage
			if (fileUrl.includes('firebasestorage.googleapis.com')) {
				try {
					const path = decodeURIComponent(fileUrl.split('/o/')[1].split('?')[0])
					const fileRef = ref(storage, path)
					downloadUrl = await getDownloadURL(fileRef)
				} catch (firebaseError) {
					console.error('Firebase download error:', firebaseError)
				}
			}

			const response = await fetch(downloadUrl)
			const blob = await response.blob()
			const url = window.URL.createObjectURL(blob)

			const link = document.createElement('a')
			link.href = url
			link.download = originalName || `download_${Date.now()}`
			document.body.appendChild(link)
			link.click()

			setTimeout(() => {
				document.body.removeChild(link)
				window.URL.revokeObjectURL(url)
			}, 100)
		} catch (error) {
			console.error('Download failed:', error)
			alert(
				'Не удалось скачать файл. Попробуйте вручную через правую кнопку мыши.'
			)
		}
	}

	const renderMediaPreview = media => {
		if (media.type === 'image') {
			return (
				<img
					src={media.url}
					alt={`Photo ${media.name}`}
					className='media-preview'
					onError={e => {
						e.target.onerror = null
						e.target.src = '../../../public/avatar.png'
					}}
				/>
			)
		} else if (media.type === 'audio') {
			return (
				<div className='audio-preview'>
					<audio controls className='audio-player'>
						<source src={media.url} type='audio/webm' />
						Ваш браузер не поддерживает аудио.
					</audio>
				</div>
			)
		} else {
			return (
				<div className='file-preview'>
					<div className='file-icon'>📄</div>
					<div className='file-name' title={media.originalName}>
						{media.name}
					</div>
				</div>
			)
		}
	}

	return (
		<div className='detail'>
			<div className='user'>
				<img
					src={user?.avatar || '../../../public/avatar.png'}
					alt='Avatar'
					onError={e => {
						e.target.onerror = null
						e.target.src = '../../../public/avatar.png'
					}}
				/>
				<h2>{user?.username}</h2>
			</div>
			<div className='info'>
				<div className='tabs'>
					<button
						className={activeTab === 'photos' ? 'active' : ''}
						onClick={() => setActiveTab('photos')}
					>
						Фото
					</button>
					<button
						className={activeTab === 'files' ? 'active' : ''}
						onClick={() => setActiveTab('files')}
					>
						Файлы
					</button>
					<button
						className={activeTab === 'audio' ? 'active' : ''}
						onClick={() => setActiveTab('audio')}
					>
						Голосовые
					</button>
				</div>

				{activeTab === 'photos' && (
					<div className='option'>
						<div className='title'>
							<span>Фотографии</span>
							<span className='count'>{photos.length}</span>
						</div>
						<div className='media-container'>
							{photos.length > 0 ? (
								photos.map((photo, index) => (
									<div className='media-item' key={index}>
										<div className='media-content'>
											{renderMediaPreview(photo)}
											<div className='media-info'>
												<span>
													{new Date(photo.createdAt).toLocaleDateString()}
												</span>
											</div>
										</div>
										<img
											src='../../../public/download.png'
											alt='Download'
											className='icon'
											onClick={() =>
												downloadFile(photo.url, photo.originalName)
											}
											title='Скачать изображение'
											onError={e => {
												e.target.onerror = null
												e.target.src = '../../../public/avatar.png'
											}}
										/>
									</div>
								))
							) : (
								<p className='no-media'>Нет загруженных фотографий</p>
							)}
						</div>
					</div>
				)}

				{activeTab === 'files' && (
					<div className='option'>
						<div className='title'>
							<span>Файлы</span>
							<span className='count'>{files.length}</span>
						</div>
						<div className='media-container'>
							{files.length > 0 ? (
								files.map((file, index) => (
									<div className='media-item' key={index}>
										<div className='media-content'>
											{renderMediaPreview(file)}
											<div className='media-info'>
												<span>{file.name}</span>
												<span>
													{new Date(file.createdAt).toLocaleDateString()}
												</span>
											</div>
										</div>
										<img
											src='../../../public/download.png'
											alt='Download'
											className='icon'
											onClick={() => downloadFile(file.url, file.originalName)}
											title='Скачать файл'
											onError={e => {
												e.target.onerror = null
												e.target.src = '../../../public/avatar.png'
											}}
										/>
									</div>
								))
							) : (
								<p className='no-media'>Нет загруженных файлов</p>
							)}
						</div>
					</div>
				)}

				{activeTab === 'audio' && (
					<div className='option'>
						<div className='title'>
							<span>Голосовые сообщения</span>
							<span className='count'>{audioMessages.length}</span>
						</div>
						<div className='audio-container'>
							{audioMessages.length > 0 ? (
								audioMessages.map((audio, index) => (
									<div className='audio-item' key={index}>
										<div className='audio-content'>
											{renderMediaPreview(audio)}
											<div className='audio-info'>
												<span>
													{new Date(audio.createdAt).toLocaleString()}
												</span>
												<span className='audio-sender'>
													{audio.senderId === currentUser.id
														? 'Вы'
														: user?.username || 'Неизвестный'}
												</span>
											</div>
										</div>
										<img
											src='../../../public/download.png'
											alt='Download'
											className='icon'
											onClick={() =>
												downloadFile(audio.url, `voice_${index}.webm`)
											}
											title='Скачать аудио'
											onError={e => {
												e.target.onerror = null
												e.target.src = '../../../public/avatar.png'
											}}
										/>
									</div>
								))
							) : (
								<p className='no-media'>Нет голосовых сообщений</p>
							)}
						</div>
					</div>
				)}

				<div className='buttons'>
					<button onClick={handleBlock}>
						{isCurrentUserBlocked
							? 'Пользователь заблокирован'
							: isReceivedBlocked
							? 'Разблокировать'
							: 'Заблокировать'}
					</button>
					<button className='logout' onClick={handleLeaveChat}>
						Покинуть чат
					</button>
				</div>
			</div>
		</div>
	)
}

export default Detail
