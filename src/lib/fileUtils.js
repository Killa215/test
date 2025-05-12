export const getFileType = file => {
	if (!file) return 'unknown'

	const type = file.type.split('/')[0]
	const extension = file.name.split('.').pop().toLowerCase()

	if (type === 'image') return 'image'
	if (type === 'video') return 'video'
	if (type === 'audio') return 'audio'

	// Проверка расширений документов
	const documentExtensions = [
		'pdf',
		'doc',
		'docx',
		'xls',
		'xlsx',
		'ppt',
		'pptx',
		'txt',
	]
	if (documentExtensions.includes(extension)) return 'document'

	return 'file'
}
