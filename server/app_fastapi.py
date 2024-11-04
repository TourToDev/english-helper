import io
import edge_tts
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sentence_splitter import SentenceSplitter
from googletrans import Translator
import asyncio

app = FastAPI()

# Enable CORS for all routes and origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the sentence splitter and translator
splitter = SentenceSplitter(language='en')
translator = Translator()
@app.post("/getStreamingAudioFromSentence")
async def get_streaming_audio_from_sentence(request: Request):
    try:
        data = await request.json()
        sentence = data.get('sentence', '')
        voice = data.get('voice', 'en-US-AvaNeural')  # Default voice

        if not sentence:
            raise HTTPException(status_code=400, detail="No sentence provided")

        communicator = edge_tts.Communicate(sentence, voice, proxy='http://127.0.0.1:7897')
        
        # Define a generator that will yield audio chunks as they are generated
        async def audio_generator():
            async for chunk in communicator.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]

        # Return a streaming response using the generator
        return StreamingResponse(
            audio_generator(),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "attachment; filename=streaming_audio_output.mp3"}
        )

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/getAudioFromSentence")
async def get_audio_from_sentence(request: Request):
    try:
        data = await request.json()
        sentence = data.get('sentence', '')
        voice = data.get('voice', 'en-US-AvaNeural')  # Default voice

        if not sentence:
            raise HTTPException(status_code=400, detail="No sentence provided")

        communicator = edge_tts.Communicate(sentence, voice, proxy='http://127.0.0.1:7897')
        audio_stream = io.BytesIO()
        
        async for chunk in communicator.stream():
            if chunk["type"] == "audio":
                audio_stream.write(chunk["data"])
        
        audio_stream.seek(0)
        return StreamingResponse(
            audio_stream,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "attachment; filename=audio_output.mp3"}
        )

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/splitSentence")
async def split_sentence(request: Request):
    try:
        data = await request.json()
        passage = data.get('passage', '')

        if not passage:
            raise HTTPException(status_code=400, detail="No passage provided")

        sentences = splitter.split(passage)
        return JSONResponse(content=sentences)

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/translate")
async def translate_text(request: Request):
    try:
        data = await request.json()
        text = data.get('text', '')
        dest_lang = data.get('dest_lang', 'en')

        if not text:
            raise HTTPException(status_code=400, detail="No text provided")

        translation = translator.translate(text, dest=dest_lang)
        return JSONResponse(content={'translated_text': translation.text})

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=3000)
