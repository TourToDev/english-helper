import io
import edge_tts
from flask import Flask, request, Response, send_file, jsonify
from flask_cors import CORS
from sentence_splitter import SentenceSplitter
from googletrans import Translator
import asyncio
import threading
def generate_audio(communicator):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    async def stream_audio():
        async for chunk in communicator.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]
    return loop.run_until_complete(stream_audio())
app = Flask(__name__)

# Enable CORS for all routes and origins
CORS(app)

# Initialize the sentence splitter and translator
splitter = SentenceSplitter(language='en')
translator = Translator()

@app.route('/getStreamingAudioFromSentence', methods=['POST'])
def get_streaming_audio_from_sentence():
    try:
        data = request.get_json()
        sentence = data.get('sentence', '')
        voice = data.get('voice', 'en-US-AvaNeural')  # Default voice

        print('sentence:', sentence)
        print('voice:', voice)

        if not sentence:
            return jsonify({"error": "No sentence provided"}), 400

        communicator = edge_tts.Communicate(sentence, voice, proxy='http://127.0.0.1:7897')

        # Create a generator
        audio_generator = generate_audio(communicator)

        return Response(audio_generator, mimetype="audio/mpeg")

    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 500

@app.route('/getAudioFromSentence', methods=['POST'])
async def get_audio_from_sentence():
    try:
        data = request.json
        sentence = data.get('sentence', '')
        voice = data.get('voice', 'en-US-AvaNeural')  # Default voice

        print('sentence:')
        print(sentence)
        print('voice:')
        print(voice)

        if not sentence:
            return {"error": "No sentence provided"}, 400

        communicator = edge_tts.Communicate(sentence, voice, proxy='http://127.0.0.1:7897')

        audio_stream = io.BytesIO()
        async for chunk in communicator.stream():
            if chunk["type"] == "audio":
                audio_stream.write(chunk["data"])

        audio_stream.seek(0)
        return send_file(audio_stream, as_attachment=True, download_name="audio_output.mp3", mimetype="audio/mpeg")

    except Exception as e:
        print(e)
        return {"error": str(e)}, 500


@app.route('/splitSentence', methods=['POST'])
def split_sentence():
    try:
        data = request.json
        passage = data.get('passage', '')
        print('passage:')
        print(passage)
        if not passage:
            return {"error": "No passage provided"}, 400

        sentences = splitter.split(passage)
        return jsonify(sentences)

    except Exception as e:
        print(e)
        return {"error": str(e)}, 500

@app.route('/translate', methods=['POST'])
def translate_text():
    try:
        data = request.json
        text = data.get('text', '')
        dest_lang = data.get('dest_lang', 'en')
        print('text:')
        print(text)
        if not text:
            return {"error": "No text provided"}, 400

        translation = translator.translate(text, dest=dest_lang)
        return jsonify({'translated_text': translation.text})

    except Exception as e:
        print(e)
        return {"error": str(e)}, 500

if __name__ == '__main__':
    app.run(debug=True)
