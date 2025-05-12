import { create } from 'zustand'
import { useUserStore } from '../lib/userStore'

export const useChatStore = create(set => ({
	chatId: null,
	user: null,
	isCurrentUserBlocked: false,
	isReceivedBlocked: false,
	isGroupChat: false,

	changeChat: (chatId, user) => {
		const currentUser = useUserStore.getState().currentUser

		// Если это групповой чат или пользователь не определен
		if (!user || user.isGroup) {
			return set({
				chatId,
				user,
				isCurrentUserBlocked: false,
				isReceivedBlocked: false,
				isGroupChat: !!user?.isGroup,
			})
		}

		// Проверяем блокировки только если есть текущий пользователь и это не групповой чат
		if (!currentUser) {
			return set({
				chatId,
				user,
				isCurrentUserBlocked: false,
				isReceivedBlocked: false,
				isGroupChat: false,
			})
		}

		// Проверяем, заблокировал ли нас пользователь
		const isCurrentUserBlocked =
			user.blocked?.includes?.(currentUser.id) ?? false

		// Проверяем, заблокировали ли мы пользователя
		const isReceivedBlocked = currentUser.blocked?.includes?.(user.id) ?? false

		return set({
			chatId,
			user,
			isCurrentUserBlocked,
			isReceivedBlocked,
			isGroupChat: false,
		})
	},

	changeBlock: () => {
		set(state => ({ ...state, isReceivedBlocked: !state.isReceivedBlocked }))
	},

	resetChat: () => {
		set({
			chatId: null,
			user: null,
			isCurrentUserBlocked: false,
			isReceivedBlocked: false,
			isGroupChat: false,
		})
	},
}))
