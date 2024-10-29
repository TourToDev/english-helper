import React, { useState, useRef } from "react";
import { Input, Button, message, Select } from "antd";
import axios from "axios";
import { split } from "sentence-splitter";
import { GlobalOutlined } from "@ant-design/icons"; // Using GlobalOutlined instead
import "./App.css";
const { Option } = Select;

const App = () => {
  const [text, setText] = useState("");
  const [sentences, setSentences] = useState([]);
  const [translations, setTranslations] = useState({});
  const [audioUrl, setAudioUrl] = useState("");
  const [hoveredSentence, setHoveredSentence] = useState("");
  const [loading, setLoading] = useState(false);
  const audioRef = useRef(null);
  const [selectedVoice, setSelectedVoice] = useState("en-US-JennyNeural"); // Default English voice
  const audioCache = useRef({});
  // Example list of English TTS voices (could be fetched from backend if available)
  const englishVoices = [
    { label: "English (US) - Jenny", value: "en-US-JennyNeural" },
    { label: "English (US) - Guy", value: "en-US-GuyNeural" },
    { label: "English (UK) - Libby", value: "en-GB-LibbyNeural" },
    { label: "English (UK) - Ryan", value: "en-GB-RyanNeural" },
    { label: "English (Australia) - Natasha", value: "en-AU-NatashaNeural" },
    { label: "English (Canada) - Clara", value: "en-CA-ClaraNeural" },
  ];

  const handleTextChange = (e) => {
    setText(e.target.value);
  };

  const handleVoiceChange = (value) => {
    setSelectedVoice(value);
  };

  const handleSplitSentences = async () => {
    const response = await axios.post("http://127.0.0.1:5000/splitSentence", {
      passage: text,
    });
    console.log("resp", response);

    setSentences(response.data.filter((i) => i.trim().length));
    setTranslations({});
  };

  const handleSentenceClick = async (sentence) => {
    if (loading) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    setLoading(true);

    if (audioCache.current[sentence]) {
      playAudio(audioCache.current[sentence]);
    } else {
      try {
        const response = await axios.post(
          "http://127.0.0.1:5000/getAudioFromSentence",
          { sentence, voice: selectedVoice },
          { responseType: "blob" }
        );
        const url = URL.createObjectURL(
          new Blob([response.data], { type: "audio/mp3" })
        );
        audioCache.current[sentence] = url;
        playAudio(url);
      } catch (error) {
        message.error("Error generating audio.");
      }
    }

    setLoading(false);
  };

  const playAudio = (url) => {
    audioRef.current = new Audio(url);
    audioRef.current.play();
  };

  const handleReadAllClick = async () => {
    if (!text) {
      message.warning("Please enter a paragraph to read.");
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    setLoading(true);

    try {
      const response = await axios.post(
        "http://127.0.0.1:5000/getAudioFromSentence",
        { sentence: text },
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(
        new Blob([response.data], { type: "audio/mp3" })
      );

      audioRef.current = new Audio(url);
      audioRef.current.play();
    } catch (error) {
      message.error("Error generating audio for the entire passage.");
    }

    setLoading(false);
  };

  const handleTranslateClick = async (sentence) => {
    setLoading(true);
    try {
      const response = await axios.post("http://127.0.0.1:5000/translate", {
        text: sentence,
        dest_lang: "zh-CN",
      });
      const translation = response.data.translated_text;

      setTranslations((prev) => ({
        ...prev,
        [sentence]: translation,
      }));

      message.success(`Translation: ${translation}`);
    } catch (error) {
      message.error("Error translating sentence.");
    }
    setLoading(false);
  };

  const renderHighlightedPassage = () => {
    return sentences.map((sentence, index) => (
      <div key={index} style={{ marginBottom: "10px" }}>
        <span
          onMouseEnter={() => setHoveredSentence(sentence)}
          onMouseLeave={() => setHoveredSentence("")}
          onClick={() => handleSentenceClick(sentence)}
          className={hoveredSentence === sentence ? "highlight" : ""}
          style={{ cursor: "pointer", display: "block" }}
        >
          {sentence}
          <GlobalOutlined
            style={{ marginLeft: "8px", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering sentence click
              handleTranslateClick(sentence);
            }}
          />
        </span>
        {translations[sentence] && (
          <div style={{ marginLeft: "20px", color: "#555" }}>
            Translation: {translations[sentence]}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div style={{ padding: "20px", width: "760px" }}>
      <Select
        style={{ width: 250, marginBottom: "10px" }}
        defaultValue={selectedVoice}
        onChange={handleVoiceChange}
      >
        {englishVoices.map((voice) => (
          <Option key={voice.value} value={voice.value}>
            {voice.label}
          </Option>
        ))}
      </Select>
      <Input.TextArea
        rows={4}
        value={text}
        onChange={handleTextChange}
        placeholder="Enter your paragraph here"
      />
      <Button
        type="primary"
        onClick={handleSplitSentences}
        style={{ marginTop: "10px" }}
      >
        Split Sentences
      </Button>
      <Button
        type="default"
        onClick={handleReadAllClick}
        style={{ marginTop: "10px", marginLeft: "10px" }}
        disabled={loading}
      >
        Read Entire Passage
      </Button>
      <div style={{ marginTop: "20px" }}>{renderHighlightedPassage()}</div>
      {audioUrl && (
        <audio controls src={audioUrl} style={{ marginTop: "20px" }} />
      )}
    </div>
  );
};

export default App;
