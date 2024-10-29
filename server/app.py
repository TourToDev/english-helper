import io
import edge_tts
import os
from flask import Flask, request, send_file
from flask_cors import CORS


app = Flask(__name__)


# Enable CORS for all routes and origins
CORS(app)

@app.route('/getAudioFromSentence', methods=['POST'])
async def get_audio_from_sentence():
    try:
        # Get the sentence from the client
        data = request.json
        sentence = data.get('sentence', '')
        print('sentence::')
        print(sentence)
        if not sentence:
            return {"error": "No sentence provided"}, 400

        # Initialize edge-tts communicator with the specified voice
        voice = "en-US-AvaNeural"  # Change voice as needed
        communicator = edge_tts.Communicate(sentence, voice)

        # Create an in-memory BytesIO stream
        audio_stream = io.BytesIO()

        # Write audio data to the BytesIO stream
        async for chunk in communicator.stream():
            if chunk["type"] == "audio":
                audio_stream.write(chunk["data"])

        # Seek to the beginning of the BytesIO stream for reading
        audio_stream.seek(0)

        # Send the audio data as a response
        response = send_file(audio_stream, as_attachment=True, download_name="audio_output.mp3", mimetype="audio/mpeg")

        return response

    except Exception as e:
        print(e)
        return {"error": str(e)}, 500

if __name__ == '__main__':
    app.run(debug=True)
