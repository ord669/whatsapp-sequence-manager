import { MetaAccount } from '@prisma/client'

const ENV_ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID?.trim()
const ENV_API_TOKEN = process.env.CHATWOOT_API_ACCESS_TOKEN?.trim()
const ENV_LABEL = process.env.CHATWOOT_ACCOUNT_LABEL?.trim()
const ENV_PHONE = process.env.CHATWOOT_ACCOUNT_PHONE?.trim()

export type ChatwootCredentials = {
	accountId: string
	apiAccessToken: string
	source: 'meta-account' | 'env'
	label?: string | null
	phoneNumber?: string | null
}

type ResolveOptions = {
	allowEnvFallback?: boolean
}

type ChatwootSourceMeta =
	| Pick<MetaAccount, 'chatwootAccountId' | 'chatwootApiAccessToken' | 'displayName' | 'phoneNumber'>
	| null
	| undefined

export function resolveChatwootCredentials(
	metaAccount?: ChatwootSourceMeta,
	options: ResolveOptions = {}
): ChatwootCredentials | null {
	const { allowEnvFallback = true } = options

	if (metaAccount?.chatwootAccountId && metaAccount.chatwootApiAccessToken) {
		return {
			accountId: metaAccount.chatwootAccountId.trim(),
			apiAccessToken: metaAccount.chatwootApiAccessToken.trim(),
			source: 'meta-account',
			label: metaAccount.displayName,
			phoneNumber: metaAccount.phoneNumber,
		}
	}

	if (allowEnvFallback && ENV_ACCOUNT_ID && ENV_API_TOKEN) {
		return {
			accountId: ENV_ACCOUNT_ID,
			apiAccessToken: ENV_API_TOKEN,
			source: 'env',
			label: ENV_LABEL || 'Chatwoot Account',
			phoneNumber: ENV_PHONE || null,
		}
	}

	return null
}

