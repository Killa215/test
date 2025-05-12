import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './lib/firebase'
import { useUserStore } from './lib/userStore'
import { useChatStore } from './lib/chatStore'
import Chat from './components/chat/Chat'
import Detail from './components/detail/Detail'
import List from './components/list/List'
import Login from './components/login/Login'
import Notification from './components/notification/Notification'

const App = () => {
	const { currentUser, isLoading, fetchUserInfo } = useUserStore()
	const { chatId } = useChatStore()

	useEffect(() => {
		const unSub = onAuthStateChanged(auth, user => {
			fetchUserInfo(user?.uid)
		})

		return () => {
			unSub()
		}
	}, [fetchUserInfo])

	if (isLoading) return <div className='loading'>Загрузка...</div>

	return (
		<HashRouter>
			<div className='container'>
				<Routes>
					<Route
						path='/'
						element={
							currentUser ? (
								<>
									<List />
									{chatId && <Chat />}
									{chatId && <Detail />}
								</>
							) : (
								<Navigate to='/login' replace />
							)
						}
					/>
					<Route
						path='/login'
						element={!currentUser ? <Login /> : <Navigate to='/' replace />}
					/>
				</Routes>
				<Notification />
			</div>
		</HashRouter>
	)
}

export default App
