import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
	build: {
		rollupOptions: {
			output: {
				manualChunks: id => {
					if (id.includes('node_modules')) {
						// Выносим тяжелые библиотеки отдельно
						if (id.includes('lodash')) return 'lodash'
						if (id.includes('react-icons')) return 'react-icons'
						if (id.includes('axios')) return 'axios'

						// Группируем остальные зависимости
						return 'vendor'
					}
				},
			},
		},
		chunkSizeWarningLimit: 1000, // Увеличиваем лимит до 1000 КБ
	},
})
