import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
	base: '/test/', // Укажите имя репозитория (test)
	plugins: [
		react({
			jsxRuntime: 'automatic',
		}),
	],
	build: {
		rollupOptions: {
			output: {
				manualChunks: id => {
					if (id.includes('node_modules')) {
						if (id.includes('lodash')) return 'lodash'
						if (id.includes('react-icons')) return 'react-icons'
						if (id.includes('axios')) return 'axios'
						return 'vendor'
					}
				},
			},
		},
		chunkSizeWarningLimit: 1000,
	},
})
