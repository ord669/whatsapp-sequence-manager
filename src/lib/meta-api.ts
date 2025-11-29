import axios from 'axios'

const META_API_VERSION = 'v18.0'
const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`

export interface MetaAccount {
  phoneNumberId: string
  accessToken: string
  wabaId: string
}

export interface TemplateComponent {
  type: string
  text?: string
  example?: {
    body_text?: string[][]
    header_text?: string[]
  }
  format?: string
  buttons?: Array<{
    type: string
    text: string
    url?: string
    phone_number?: string
  }>
}

export interface CreateTemplateParams {
  name: string
  language: string
  category: string
  components: TemplateComponent[]
}

export interface SendMessageParams {
  to: string
  templateName: string
  languageCode: string
  components?: Array<{
    type: string
    parameters: Array<{
      type: string
      text: string
    }>
  }>
}

export class MetaAPI {
  private phoneNumberId: string
  private accessToken: string
  private wabaId: string

  constructor(account: MetaAccount) {
    this.phoneNumberId = account.phoneNumberId
    this.accessToken = account.accessToken
    this.wabaId = account.wabaId
  }

  // Verify connection by getting phone number details
  async verifyConnection() {
    try {
      const response = await axios.get(
        `${META_API_BASE_URL}/${this.phoneNumberId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
          params: {
            fields: 'verified_name,display_phone_number,quality_rating,code_verification_status',
          },
        }
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      }
    }
  }

  // Get WABA (WhatsApp Business Account) details
  async getWABADetails() {
    try {
      const response = await axios.get(
        `${META_API_BASE_URL}/${this.wabaId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
          params: {
            fields: 'name,timezone_id,message_template_namespace,account_review_status,business_verification_status,owner_business_info',
          },
        }
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      }
    }
  }

  // Create a message template
  async createTemplate(params: CreateTemplateParams) {
    try {
      const response = await axios.post(
        `${META_API_BASE_URL}/${this.wabaId}/message_templates`,
        params,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      }
    }
  }

  // List all templates
  async listTemplates() {
    try {
      const response = await axios.get(
        `${META_API_BASE_URL}/${this.wabaId}/message_templates`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
          params: {
            limit: 100,
          },
        }
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      }
    }
  }

  // Get template by name
  async getTemplate(templateName: string) {
    try {
      const response = await axios.get(
        `${META_API_BASE_URL}/${this.wabaId}/message_templates`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
          params: {
            name: templateName,
          },
        }
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      }
    }
  }

  // Send a template message
  async sendTemplateMessage(params: SendMessageParams) {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: params.to.replace(/[^\d]/g, ''), // Remove all non-digits
        type: 'template',
        template: {
          name: params.templateName,
          language: {
            code: params.languageCode,
          },
          ...(params.components && { components: params.components }),
        },
      }

      const response = await axios.post(
        `${META_API_BASE_URL}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      }
    }
  }

  // Get message status
  async getMessageStatus(messageId: string) {
    try {
      const response = await axios.get(
        `${META_API_BASE_URL}/${messageId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      }
    }
  }
}

