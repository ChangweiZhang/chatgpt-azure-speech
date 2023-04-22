import logo from './logo.svg'
import './App.css'
import React, { useState } from 'react'
import '@chatui/core/es/styles/index.less'
import * as sdk from 'microsoft-cognitiveservices-speech-sdk'
import { Buffer } from 'buffer'
//import '@video-react/' // import css
// 引入组件
import Chat, { Bubble, useMessages } from '@chatui/core'
import { Player } from 'video-react'
// 引入样式
import '@chatui/core/dist/index.css'
import { getTokenOrRefresh } from './token_util'
import { ResultReason } from 'microsoft-cognitiveservices-speech-sdk'

let Azure_OpenAI_Endpoint: string = ''
let Azure_OpenAI_Key: string = ''
let Azure_OpenAI_DeploymentName: string = ''
let Azure_Speech_Key: string = ''
let Azure_Speech_Region: string = ''

interface MessageItem {
  role: string
  content: string
}
const speechsdk = require('microsoft-cognitiveservices-speech-sdk')
let chatMsgs: MessageItem[] = []
let muiltLangMsg: MessageItem = {
  role: 'system',
  content:
    '你是个AI问答助手,请识别每次问答的语言，并严格按照以下的json格式给出恰当的答复，无需解释直接给出json内容。{"input-lang":"[用户输入的语言代码,例如en-US,zh-CN,ja-JP]","output-lang":"[你输出内容的语言代码]","content":"[你的回答内容]"}',
}
let defaultMsg: MessageItem = {
  role: 'system',
  content:
    '你是一个AI助手，帮助回答用户的问题',
}
let systemMsg: MessageItem = {
  role: 'system',
  content:
    '你是一个AI助手，帮助回答用户的问题',
}

const audioConfig = speechsdk.AudioConfig.fromDefaultMicrophoneInput()
const speakerAudioConfig = speechsdk.AudioConfig.fromDefaultSpeakerOutput()
// Create the speech synthesizer.
let synthesizer: sdk.SpeechSynthesizer
let isMultiLang: boolean = false
let speechConfig: sdk.SpeechConfig
let recognizer: sdk.SpeechRecognizer
// The language of the voice that speaks.

const initialMessages = [
  {
    type: 'text',
    content: { text: '主人好，我是智能助理，你的贴心小助手~' },
    user: {
      avatar:
        'https://th.bing.com/th?id=ODLS.8bba7513-8633-4855-b376-c8bcac465d63',
    },
  },
]
const defaultQuickReplies = [
  {
    icon: 'message',
    name: '清除聊天',
    isNew: false,
    isHighlight: true,
  },
  {
    icon: 'mic',
    name: '开始语音对话',
    isNew: false,
    isHighlight: true,
  },
  {
    icon: 'mic',
    name: '停止语音对话',
    isNew: true,
    isHighlight: true,
  },
  {
    icon: 'smile',
    name: '多语言对话',
    isNew: true,
    isHighlight: true,
  },
]
export default function App() {
  const { messages, appendMsg, setTyping, resetList } = useMessages(
    initialMessages,
  )

  const [open, setOpen] = useState(true)
  const [speechKey, setSpeechKey] = useState(Azure_Speech_Key)
  const [speechRegion, setSpeechRegion] = useState(Azure_Speech_Region)
  //let isMultiLang: boolean = false
  //const [isMultiLang, setIsMultiLang] = useState(false)

  function handleSend(type: any, val: any) {
    if (type === 'text' && val.trim()) {
      appendMsg({
        type: 'text',
        content: { text: val },
        position: 'right',
      })

      let msgRecord: MessageItem = {
        role: 'user',
        content: val,
      }
      chatMsgs.push(msgRecord)

      setTyping(true)

      fetch(
        Azure_OpenAI_Endpoint +
          'openai/deployments/' +
          Azure_OpenAI_DeploymentName +
          '/chat/completions?api-version=2023-03-15-preview',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': Azure_OpenAI_Key,
          },
          body: JSON.stringify({
            messages: [systemMsg, ...chatMsgs],
            temperature: 0.7,
            top_p: 0.95,
            frequency_penalty: 0,
            presence_penalty: 0,
            max_tokens: 800,
            stop: null,
          }),
        },
      )
        .then(function (response) {
          response.json().then(
            (res) => {
              let respContent: string
              if (!speechConfig) {
                speechConfig = sdk.SpeechConfig.fromSubscription(
                  speechKey,
                  speechRegion,
                )
                speechConfig.speechRecognitionLanguage = 'zh-CN'
              }
              console.log('1:' + isMultiLang)
              if (!isMultiLang) {
                speechConfig.speechSynthesisLanguage = 'zh-CN'
                speechConfig.speechSynthesisVoiceName = 'zh-CN-XiaochenNeural'
                respContent = res.choices[0].message.content
              } else {
                let outputMsg = res.choices[0].message.content
                let respData = JSON.parse(outputMsg)
                let langCode = respData['output-lang']
                console.log(langCode)
                console.log(respData)
                console.log(speechConfig.speechSynthesisLanguage)
                respContent = respData.content
               
              }
              if (!synthesizer) {
                synthesizer = sdk.SpeechSynthesizer.FromConfig(
                  speechConfig,
                  sdk.AutoDetectSourceLanguageConfig.fromOpenRange(),
                  speakerAudioConfig,
                )
              }
              if (res.usage.total_tokens > 28800) {
                chatMsgs.splice(0, chatMsgs.length / 2)
              }
              console.log(respContent)
              if (open) {
                synthesizer.speakTextAsync(respContent, function (result) {
                  if (
                    result.reason ===
                    sdk.ResultReason.SynthesizingAudioCompleted
                  ) {
                    console.log('synthesis finished.')
                    // synthesizer!.close()

                    return result.audioData
                  } else {
                    console.error(
                      'Speech synthesis canceled, ' +
                        result.errorDetails +
                        '\nDid you set the speech resource key and region values?',
                    )
                  }
                })
              }
              appendMsg({
                type: 'text',
                content: { text: respContent },
                user: {
                  avatar:
                    'https://th.bing.com/th?id=ODLS.8bba7513-8633-4855-b376-c8bcac465d63',
                },
              })
              chatMsgs.push(res.choices[0].message)
              // Start the synthesizer and wait for a result.
            },
            (reason) => setTyping(false),
          )
        })
        .catch(function (err) {
          alert(err)
          setTyping(false)
        })
    }
  }
  function handleQuickReplyClick(item: any) {
    if (item.name === '清除聊天') {
      chatMsgs = []
      resetList()
      appendMsg(initialMessages[0])
    }
    if (item.name === '开始语音对话') {
      setOpen(true)
      sttFromMicContinously()
    }
    if (item.name === '停止语音对话') {
      setOpen(false)
      recognizer.stopContinuousRecognitionAsync()
      //synthesizer.close()
    }
    if (item.name === '多语言对话') {
      // setIsMultiLang(!isMultiLang)
      console.log('2:' + isMultiLang)
      //setIsMultiLang((curr) => !curr)
      isMultiLang = !isMultiLang
      console.log('3:' + isMultiLang)
      chatMsgs = []
      systemMsg = isMultiLang ? muiltLangMsg : defaultMsg
      appendMsg({
        type: 'text',
        content: { text: '多语言对话已' + (isMultiLang ? '开启' : '关闭') },
        position: 'left',
        user: {
          avatar:
            'https://th.bing.com/th?id=ODLS.8bba7513-8633-4855-b376-c8bcac465d63',
        },
      })
    }
  }

  function sttFromMicContinously() {
    if (!speechConfig) {
      speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion)
      speechConfig.speechRecognitionLanguage = 'zh-CN'
    }
    if (!recognizer) {
      recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig)
    }

    recognizer.recognized = (s, e) => {
      let recognizedText
      if (e.result.reason == sdk.ResultReason.RecognizedSpeech) {
        console.log(`RECOGNIZED: Text=${e.result.text}`)
        recognizedText = e.result.text
        handleSend('text', recognizedText)
      } else if (e.result.reason == sdk.ResultReason.NoMatch) {
        console.log('NOMATCH: Speech could not be recognized.')
        recognizedText = '无法识别的内容'
        appendMsg({
          type: 'text',
          content: { text: recognizedText },
          position: 'left',
        })
      }
    }

    recognizer.canceled = (s, e) => {
      console.log(`CANCELED: Reason=${e.reason}`)

      if (e.reason == sdk.CancellationReason.Error) {
        console.log(`"CANCELED: ErrorCode=${e.errorCode}`)
        console.log(`"CANCELED: ErrorDetails=${e.errorDetails}`)
        console.log(
          'CANCELED: Did you set the speech resource key and region values?',
        )
      }

      recognizer.stopContinuousRecognitionAsync()
    }

    recognizer.sessionStopped = (s, e) => {
      console.log('\n    Session stopped event.')
      recognizer.stopContinuousRecognitionAsync()
    }
    recognizer.startContinuousRecognitionAsync()
  }

  function renderMessageContent(msg: any) {
    const { content } = msg

    return <Bubble content={content.text} />
  }
  async function onButtonClick(btn: any) {
    console.log('click')
    //sttFromMicContinously()
  }

  return (
    <Chat
      navbar={{
        title: '',
        leftContent: {
          label: 'Azure OpenAI Chat',
        },
        
        rightContent: [
          {
            icon: 'apps',
            onClick: onButtonClick,
          },
        ],
      }}
      messages={messages}
      renderMessageContent={renderMessageContent}
      onSend={handleSend}
      quickReplies={defaultQuickReplies}
      onQuickReplyClick={handleQuickReplyClick}
    />
  )
}
