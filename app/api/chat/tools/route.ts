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

  try {
    // last prompt
    const message = messages[messages.length - 1]

    let translatedContent = message.content
    console.warn("===========Source Message============== ", message)
    try {
      const response = await fetch("https://api.translate.tomyo.mn/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: message.content })
      })
      translatedContent = await response.text()
      console.warn(
        "===========Translated content==============",
        translatedContent
      )

      messages.push({ ...message, content: translatedContent })
    } catch (error: any) {
      console.error("Error translating content", error)
    }

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(translatedContent)
      }
    })

    return new StreamingTextResponse(stream)
  } catch (error: any) {
    console.error(error)
    const errorMessage = error.error?.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
