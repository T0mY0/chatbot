import { openapiToFunctions } from "@/lib/openapi-conversion"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { Tables } from "@/supabase/types"
import { ChatSettings } from "@/types"
import { OpenAIStream, StreamingTextResponse } from "ai"
import OpenAI from "openai"
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"

export async function POST(request: Request) {
  const json = await request.json()
  const { chatSettings, messages, selectedTools } = json as {
    chatSettings: ChatSettings
    messages: any[]
    selectedTools: Tables<"tools">[]
  }
  const responses: string[] = []
  try {
    // last prompt
    const message = messages[messages.length - 1]

    for (const selectedTool of selectedTools) {
      try {
        const convertedSchema = await openapiToFunctions(
          JSON.parse(selectedTool.schema as string)
        )
        // convertedSchema example:
        // {
        //   info: {
        //     title: 'Translate data using t0my0-18m model API',
        //     description: 'Translate data using t0my0-18m model API',
        //     server: 'https://api.translate.tomyo.mn'
        //   },
        //   routes: [
        //     {
        //       path: '/predict',
        //       method: 'post',
        //       operationId: 'TranslateData',
        //       requestInBody: true
        //     }
        //   ],
        // }
        const url = `${convertedSchema.info.server}${convertedSchema.routes[0].path}`
        const method = convertedSchema.routes[0].method
        const toolId = selectedTool.id

        const translatedContent = await invokeToolApi(
          url,
          method,
          message.content
        )
        //messages.push({ ...message, content: translatedContent })
        responses.push(translatedContent || message.content)
      } catch (error: any) {
        console.error("Error converting OpenAPI schema", error)
      }
    }

    const stream = new ReadableStream({
      start(controller) {
        //controller.enqueue(translatedContent)
        for (const response of responses) {
          controller.enqueue(response)
        }
        controller.close()
      }
    })

    return new StreamingTextResponse(stream)
  } catch (error: any) {
    const errorMessage = error.error?.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}

async function invokeToolApi(url: string, method: string, text: string) {
  let translatedContent = text
  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    })
    translatedContent = await response.text()

    return translatedContent
  } catch (error: any) {
    console.error("Error translating content", error)
  }
}
