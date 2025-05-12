import { useEffect, useRef, useState } from 'react'
import './chat.css'
import EmojiPicker from 'emoji-picker-react'
import {
	arrayUnion,
	arrayRemove,
	doc,
	getDoc,
	onSnapshot,
	updateDoc,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useChatStore } from '../../lib/chatStore'
import { useUserStore } from '../../lib/userStore'
import upload from '../../lib/upload'
import { getFileType } from '../../lib/fileUtils'
import { toast } from 'react-toastify'

const Chat = () => {
	const [chat, setChat] = useState(null)
	const [openEmojiPicker, setOpenEmojiPicker] = useState(false)
	const [messageText, setMessageText] = useState('')
	const [mediaToSend, setMediaToSend] = useState({
		file: null,
		url: '',
		type: '',
	})
	const [isRecording, setIsRecording] = useState(false)
	const [showWebcam, setShowWebcam] = useState(false)
	const [recordingTime, setRecordingTime] = useState(0)
	const [audioChunks, setAudioChunks] = useState([])
	const [userNames, setUserNames] = useState({})
	const [selectedMessage, setSelectedMessage] = useState(null)
	const [showEditModal, setShowEditModal] = useState(false)
	const [chatTitle, setChatTitle] = useState('')
	const [chatAvatar, setChatAvatar] = useState(null)
	const [avatarPreview, setAvatarPreview] = useState('')

	const audioChunksRef = useRef([])
	const videoRef = useRef(null)
	const canvasRef = useRef(null)
	const mediaRecorderRef = useRef(null)
	const endRef = useRef(null)
	const recordingIntervalRef = useRef(null)
	const [contextMenu, setContextMenu] = useState({
		visible: false,
		x: 0,
		y: 0,
		message: null,
	})

	const { currentUser } = useUserStore()
	const { chatId, user, isCurrentUserBlocked, isReceivedBlocked } =
		useChatStore()

	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [chat])

	useEffect(() => {
		const unsubscribe = onSnapshot(doc(db, 'chats', chatId), async snapshot => {
			const chatData = snapshot.data()
			setChat(chatData)

			if (chatData) {
				setChatTitle(chatData.chatName || '')
				setAvatarPreview(chatData.chatAvatar || '')
			}

			if (chatData?.messages) {
				const uniqueSenderIds = [
					...new Set(chatData.messages.map(m => m.senderId)),
				]
				const names = { ...userNames }

				for (const senderId of uniqueSenderIds) {
					if (!names[senderId] && senderId !== currentUser.id) {
						try {
							const userDoc = await getDoc(doc(db, 'user', senderId))
							if (userDoc.exists()) {
								names[senderId] = userDoc.data().username
							}
						} catch (error) {
							console.error('Error fetching user name:', error)
							names[senderId] = 'Неизвестный'
						}
					}
				}

				setUserNames(names)
			}
		})

		return () => unsubscribe()
	}, [chatId])

	useEffect(() => {
		return () => {
			if (
				mediaRecorderRef.current &&
				mediaRecorderRef.current.state !== 'inactive'
			) {
				mediaRecorderRef.current.stop()
			}
			clearInterval(recordingIntervalRef.current)
			stopWebcam()
		}
	}, [])

	useEffect(() => {
		const handleClickOutside = () => {
			if (contextMenu.visible) {
				setContextMenu({ visible: false, x: 0, y: 0, message: null })
			}
		}
		document.addEventListener('click', handleClickOutside)
		return () => document.removeEventListener('click', handleClickOutside)
	}, [contextMenu.visible])

	useEffect(() => {
		if (showWebcam) {
			startWebcam()
		} else {
			stopWebcam()
		}
	}, [showWebcam])

	const startWebcam = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'user' },
				audio: false,
			})
			if (videoRef.current) {
				videoRef.current.srcObject = stream
			}
		} catch (err) {
			console.error('Camera access error:', err)
			setShowWebcam(false)
		}
	}

	const stopWebcam = () => {
		if (videoRef.current?.srcObject) {
			videoRef.current.srcObject.getTracks().forEach(track => track.stop())
			videoRef.current.srcObject = null
		}
	}

	const capturePhoto = async () => {
		if (videoRef.current && canvasRef.current) {
			const context = canvasRef.current.getContext('2d')
			canvasRef.current.width = videoRef.current.videoWidth
			canvasRef.current.height = videoRef.current.videoHeight
			context.drawImage(
				videoRef.current,
				0,
				0,
				canvasRef.current.width,
				canvasRef.current.height
			)

			canvasRef.current.toBlob(
				blob => {
					const file = new File([blob], `photo_${Date.now()}.jpg`, {
						type: 'image/jpeg',
					})
					setMediaToSend({
						file,
						url: URL.createObjectURL(blob),
						type: 'image',
					})
					setShowWebcam(false)
				},
				'image/jpeg',
				0.9
			)
		}
	}

	const toggleRecording = async () => {
		if (isCurrentUserBlocked || isReceivedBlocked) return

		if (isRecording) {
			stopRecording()
		} else {
			startRecording()
		}
	}

	const startRecording = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			const mediaRecorder = new MediaRecorder(stream)
			mediaRecorderRef.current = mediaRecorder
			audioChunksRef.current = []

			mediaRecorder.ondataavailable = e => {
				if (e.data.size > 0) {
					audioChunksRef.current.push(e.data)
				}
			}

			mediaRecorder.onstop = async () => {
				const audioBlob = new Blob(audioChunksRef.current, {
					type: 'audio/webm',
				})
				const audioUrl = URL.createObjectURL(audioBlob)
				const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, {
					type: 'audio/webm',
				})

				setMediaToSend({
					file: audioFile,
					url: audioUrl,
					type: 'audio',
				})

				stream.getTracks().forEach(track => track.stop())
			}

			mediaRecorder.start(100)
			setIsRecording(true)
			setRecordingTime(0)
			recordingIntervalRef.current = setInterval(() => {
				setRecordingTime(prev => prev + 1)
			}, 1000)
		} catch (err) {
			console.error('Ошибка при записи голоса:', err)
			toast.error('Не удалось начать запись голоса')
		}
	}

	const stopRecording = () => {
		if (mediaRecorderRef.current && isRecording) {
			mediaRecorderRef.current.stop()
			clearInterval(recordingIntervalRef.current)
			setIsRecording(false)
		}
	}

	const handleContextMenu = (e, message) => {
		e.preventDefault()
		if (message.senderId === currentUser.id) {
			setContextMenu({
				visible: true,
				x: e.clientX,
				y: e.clientY,
				message,
			})
		}
	}

	const closeContextMenu = () => {
		setContextMenu({ visible: false, x: 0, y: 0, message: null })
	}

	const deleteMessage = async () => {
		if (!contextMenu.message) return

		try {
			const chatRef = doc(db, 'chats', chatId)

			// Удаляем сообщение из чата
			await updateDoc(chatRef, {
				messages: arrayRemove(contextMenu.message),
			})

			// Получаем обновленный список сообщений
			const chatDoc = await getDoc(chatRef)
			const messages = chatDoc.data()?.messages || []

			// Определяем новое последнее сообщение
			let newLastMessage = 'Нет сообщений'
			if (messages.length > 0) {
				const lastMsg = messages[messages.length - 1]
				newLastMessage = lastMsg.text || getMediaPreviewText(lastMsg.mediaType)
			}

			// Обновляем userchats для обоих пользователей
			const userIDs = [currentUser.id, user.id]
			for (const userId of userIDs) {
				const userChatsRef = doc(db, 'userchats', userId)
				const userChatsSnapshot = await getDoc(userChatsRef)

				if (userChatsSnapshot.exists()) {
					const userChatsData = userChatsSnapshot.data()
					const chatIndex = userChatsData.chats.findIndex(
						c => c.chatId === chatId
					)

					if (chatIndex !== -1) {
						const updatedChats = [...userChatsData.chats]
						updatedChats[chatIndex] = {
							...updatedChats[chatIndex],
							lastMessage: newLastMessage,
							updatedAt: Date.now(),
						}

						await updateDoc(userChatsRef, {
							chats: updatedChats,
						})
					}
				}
			}

			closeContextMenu()
			toast.success('Сообщение удалено')
		} catch (error) {
			console.error('Ошибка при удалении сообщения:', error)
			toast.error('Не удалось удалить сообщение')
		}
	}

	const handleFileSelect = e => {
		if (e.target.files[0]) {
			const file = e.target.files[0]
			const type = getFileType(file)
			setMediaToSend({
				file,
				url: URL.createObjectURL(file),
				type,
			})
		}
	}

	const handleAvatarSelect = e => {
		if (e.target.files[0]) {
			const file = e.target.files[0]
			setChatAvatar(file)
			setAvatarPreview(URL.createObjectURL(file))
		}
	}

	const clearMediaPreview = () => {
		setMediaToSend({ file: null, url: '', type: '' })
	}

	const addEmoji = emojiData => {
		setMessageText(prev => prev + emojiData.emoji)
	}

	const sendMessage = async () => {
		if (!messageText.trim() && !mediaToSend.file) return

		try {
			let mediaUrl = null
			let mediaType = null

			if (mediaToSend.file) {
				mediaUrl = await upload(mediaToSend.file)
				mediaType = mediaToSend.type
			}

			const newMessage = {
				senderId: currentUser.id,
				createdAt: new Date(),
				...(messageText.trim() && { text: messageText.trim() }),
				...(mediaUrl && { media: mediaUrl, mediaType }),
			}

			await updateDoc(doc(db, 'chats', chatId), {
				messages: arrayUnion(newMessage),
			})

			const lastMessageContent = messageText.trim()
				? messageText.trim()
				: mediaUrl
				? getMediaPreviewText(mediaType)
				: ''

			if (lastMessageContent) {
				const userIDs = [currentUser.id, user.id]

				for (const userId of userIDs) {
					const userChatsRef = doc(db, 'userchats', userId)
					const userChatsSnapshot = await getDoc(userChatsRef)

					if (userChatsSnapshot.exists()) {
						const userChatsData = userChatsSnapshot.data()
						const chatIndex = userChatsData.chats.findIndex(
							c => c.chatId === chatId
						)

						if (chatIndex !== -1) {
							const updatedChats = [...userChatsData.chats]
							updatedChats[chatIndex] = {
								...updatedChats[chatIndex],
								lastMessage: lastMessageContent,
								isSeen: userId === currentUser.id,
								updatedAt: Date.now(),
							}

							await updateDoc(userChatsRef, {
								chats: updatedChats,
							})
						}
					}
				}
			}

			setMessageText('')
			setMediaToSend({ file: null, url: '', type: '' })
		} catch (error) {
			console.error('Ошибка при отправке сообщения:', error)
		}
	}

	const saveChatChanges = async () => {
		try {
			const chatRef = doc(db, 'chats', chatId)
			const updates = {}

			if (chatTitle && chatTitle !== chat?.chatName) {
				updates.chatName = chatTitle
			}

			if (chatAvatar) {
				const avatarUrl = await upload(chatAvatar)
				updates.chatAvatar = avatarUrl
			} else if (avatarPreview === '' && chat?.chatAvatar) {
				// Если аватар был удален
				updates.chatAvatar = ''
			}

			if (Object.keys(updates).length > 0) {
				await updateDoc(chatRef, updates)

				// Обновляем информацию в userchats для всех участников
				const userIDs = [currentUser.id, user.id]
				for (const userId of userIDs) {
					const userChatsRef = doc(db, 'userchats', userId)
					const userChatsSnapshot = await getDoc(userChatsRef)

					if (userChatsSnapshot.exists()) {
						const userChatsData = userChatsSnapshot.data()
						const chatIndex = userChatsData.chats.findIndex(
							c => c.chatId === chatId
						)

						if (chatIndex !== -1) {
							const updatedChats = [...userChatsData.chats]
							updatedChats[chatIndex] = {
								...updatedChats[chatIndex],
								...(updates.chatName && { chatName: updates.chatName }),
								...(updates.chatAvatar !== undefined && {
									chatAvatar: updates.chatAvatar,
								}),
							}

							await updateDoc(userChatsRef, {
								chats: updatedChats,
							})
						}
					}
				}

				toast.success('Изменения чата сохранены')
			}

			setShowEditModal(false)
		} catch (error) {
			console.error('Ошибка при сохранении изменений чата:', error)
			toast.error('Не удалось сохранить изменения')
		}
	}

	const getMediaPreviewText = type => {
		switch (type) {
			case 'image':
				return '📷 Фото'
			case 'video':
				return '🎬 Видео'
			case 'audio':
				return '🎤 Голосовое сообщение'
			case 'document':
				return '📄 Документ'
			default:
				return '📁 Файл'
		}
	}

	const renderMediaPreview = media => {
		if (!media) return null

		switch (media.type) {
			case 'image':
				return (
					<img
						src={media.url}
						alt='Превью изображения'
						className='media-preview'
					/>
				)
			case 'video':
				return (
					<video controls className='media-preview'>
						<source src={media.url} type='video/mp4' />
						Ваш браузер не поддерживает видео.
					</video>
				)
			case 'audio':
				return (
					<div className='audio-message-preview'>
						<audio controls className='media-preview'>
							<source src={media.url} type='audio/webm' />
							Ваш браузер не поддерживает аудио.
						</audio>
					</div>
				)
			default:
				return (
					<div className='file-preview'>
						<div className='file-icon'>📄</div>
						<div className='file-name'>{media.file.name}</div>
					</div>
				)
		}
	}

	const handleKeyPress = e => {
		if (e.key === 'Enter' && (messageText.trim() || mediaToSend.file)) {
			sendMessage()
		}
	}

	const formatRecordingTime = seconds => {
		const mins = Math.floor(seconds / 60)
		const secs = seconds % 60
		return `${mins.toString().padStart(2, '0')}:${secs
			.toString()
			.padStart(2, '0')}`
	}

	const getSenderName = senderId => {
		if (senderId === currentUser.id) return currentUser.username
		return userNames[senderId] || 'Неизвестный'
	}

	const handleMessageClick = message => {
		setSelectedMessage(selectedMessage?.id === message.id ? null : message)
	}

	const renderMessageContent = message => {
		return (
			<>
				{message.text && <p>{message.text}</p>}
				{message.media && (
					<div className='media-container'>
						{message.mediaType === 'image' && (
							<img src={message.media} alt='' className='media-content' />
						)}
						{message.mediaType === 'video' && (
							<video controls className='media-content'>
								<source src={message.media} type='video/mp4' />
								Ваш браузер не поддерживает видео.
							</video>
						)}
						{message.mediaType === 'audio' && (
							<div className='audio-message'>
								<audio controls className='media-content'>
									<source src={message.media} type='audio/webm' />
									Ваш браузер не поддерживает аудио.
								</audio>
							</div>
						)}
						{message.mediaType === 'document' && (
							<a
								href={message.media}
								target='_blank'
								rel='noopener noreferrer'
								className='document-link'
							>
								📄 Документ
							</a>
						)}
					</div>
				)}
			</>
		)
	}

	const isBlocked = isCurrentUserBlocked || isReceivedBlocked

	return (
		<div className='chat' onClick={closeContextMenu}>
			{/* Шапка чата */}
			<div className='top'>
				<div className='user'>
					<img
						src={
							chat?.chatAvatar || user?.avatar || '../../../public/avatar.png'
						}
						alt=''
					/>
					<div className='texts'>
						<span>{chat?.chatName || user?.username}</span>
					</div>
				</div>
				<div className='icons'>
					<img src='../../../public/phone.png' alt='' />
					<img src='../../../public/video.png' alt='' />
					{/* Показываем кнопку редактирования только для групповых чатов */}
					{chat?.isGroup && (
						<img
							src='../../../public/edit.png'
							alt=''
							onClick={() => setShowEditModal(true)}
							style={{ cursor: 'pointer' }}
						/>
					)}
				</div>
			</div>

			{/* Область сообщений */}
			<div className='center'>
				{chat?.messages?.map(message => (
					<div
						key={message.createdAt?.toMillis?.() || message.createdAt}
						className={`message ${
							message.senderId === currentUser.id ? 'own' : ''
						} ${selectedMessage?.id === message.id ? 'selected' : ''}`}
						onClick={() => handleMessageClick(message)}
						onContextMenu={e => handleContextMenu(e, message)}
					>
						{(message.senderId !== currentUser.id || chat?.isGroup) && (
							<div className='sender-info'>
								<span className='sender-name'>
									{getSenderName(message.senderId)}
								</span>
							</div>
						)}
						<div className='texts'>{renderMessageContent(message)}</div>
					</div>
				))}
				{mediaToSend.url && (
					<div className='message own'>
						<div className='texts'>
							{renderMediaPreview(mediaToSend)}
							<button className='clear-media-btn' onClick={clearMediaPreview}>
								×
							</button>
						</div>
					</div>
				)}
				<div ref={endRef} />
			</div>

			{/* Контекстное меню */}
			{contextMenu.visible && (
				<div
					className='context-menu'
					style={{
						position: 'fixed',
						top: contextMenu.y,
						left: contextMenu.x - 200,
						zIndex: 1000,
					}}
					onClick={e => e.stopPropagation()}
				>
					<button className='context-menu-item' onClick={deleteMessage}>
						Удалить
					</button>
				</div>
			)}

			{/* Модальное окно редактирования чата */}
			{showEditModal && (
				<div className='modal-overlay'>
					<div className='edit-chat-modal'>
						<div className='modal-header'>
							<h3>Редактировать чат</h3>
							<button
								className='close-btn'
								onClick={() => setShowEditModal(false)}
							>
								×
							</button>
						</div>

						<div className='modal-body'>
							<div className='form-group'>
								<label>Название чата</label>
								<input
									type='text'
									value={chatTitle}
									onChange={e => setChatTitle(e.target.value)}
									placeholder='Введите название чата'
								/>
							</div>

							<div className='form-group'>
								<label>Аватар чата</label>
								<div className='avatar-upload'>
									<div className='avatar-preview'>
										<img
											src={avatarPreview || '../../../public/avatar.png'}
											alt='Аватар чата'
										/>
									</div>
									<div className='avatar-upload-controls'>
										<label className='upload-btn'>
											Выбрать файл
											<input
												type='file'
												accept='image/*'
												onChange={handleAvatarSelect}
												style={{ display: 'none' }}
											/>
										</label>
										{avatarPreview && (
											<button
												className='remove-btn'
												onClick={() => {
													setAvatarPreview('')
													setChatAvatar(null)
												}}
											>
												Удалить
											</button>
										)}
									</div>
								</div>
							</div>
						</div>

						<div className='modal-footer'>
							<button
								className='cancel-btn'
								onClick={() => setShowEditModal(false)}
							>
								Отмена
							</button>
							<button
								className='save-btn'
								onClick={saveChatChanges}
								disabled={!chatTitle && !chatAvatar && avatarPreview === ''}
							>
								Сохранить
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Модальное окно веб-камеры */}
			{showWebcam && (
				<div className='webcam-modal-overlay'>
					<div className='webcam-modal'>
						<div className='webcam-header'>
							<h3>Сделайте фото</h3>
							<button
								className='close-btn'
								onClick={() => setShowWebcam(false)}
							>
								×
							</button>
						</div>
						<div className='webcam-preview-container'>
							<video
								ref={videoRef}
								autoPlay
								playsInline
								className='webcam-video'
							/>
							<canvas ref={canvasRef} style={{ display: 'none' }} />
						</div>
						<div className='webcam-controls'>
							<button className='capture-btn' onClick={capturePhoto}>
								<div className='capture-icon'></div>
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Панель ввода */}
			<div className='bottom'>
				<div className='icons'>
					<label htmlFor='file'>
						<img
							src='../../../public/download.png'
							alt=''
							className={isBlocked ? 'disabled' : ''}
							title='Прикрепить файл'
						/>
					</label>
					<input
						type='file'
						id='file'
						style={{ display: 'none' }}
						onChange={!isBlocked ? handleFileSelect : undefined}
						disabled={isBlocked}
						accept='image/*, video/*, audio/*, .pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .txt'
					/>

					<img
						src='../../../public/camera.png'
						alt=''
						className={isBlocked ? 'disabled' : ''}
						onClick={!isBlocked ? () => setShowWebcam(true) : undefined}
						title='Сделать фото'
					/>

					<div className='mic-button-container'>
						<img
							src={`../../../public/mic.png`}
							alt=''
							className={`mic-button ${isRecording ? 'recording' : ''} ${
								isBlocked ? 'disabled' : ''
							}`}
							onClick={!isBlocked ? toggleRecording : undefined}
							title={
								isRecording
									? 'Остановить запись'
									: 'Записать голосовое сообщение'
							}
						/>
						{isRecording && (
							<div className='recording-time'>
								{formatRecordingTime(recordingTime)}
							</div>
						)}
					</div>
				</div>

				<input
					type='text'
					value={messageText}
					onChange={e => setMessageText(e.target.value)}
					onKeyPress={handleKeyPress}
					placeholder={
						isBlocked ? 'Вы не сможете отправить сообщение' : 'Сообщение...'
					}
					disabled={isBlocked}
				/>

				<div className='emoji'>
					<img
						src='../../../public/emoji.png'
						alt=''
						className={isBlocked ? 'disabled' : ''}
						onClick={
							!isBlocked
								? () => setOpenEmojiPicker(!openEmojiPicker)
								: undefined
						}
						title='Эмодзи'
					/>

					{openEmojiPicker && !isBlocked && (
						<div className='picker'>
							<EmojiPicker onEmojiClick={addEmoji} />
						</div>
					)}
				</div>

				<button
					className='sendButton'
					onClick={sendMessage}
					disabled={isBlocked || (!messageText.trim() && !mediaToSend.file)}
					title='Отправить'
				>
					Отправить
				</button>
			</div>
		</div>
	)
}

export default Chat
