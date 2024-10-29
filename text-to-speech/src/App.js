import React, { useState, useRef } from "react";
import { Input, Button, message } from "antd";
import axios from "axios";
import { split } from "sentence-splitter";
import { GlobalOutlined } from "@ant-design/icons"; // Using GlobalOutlined instead
import "./App.css";

const App = () => {
  const [text, setText] = useState("");
  const [sentences, setSentences] = useState([]);
  const [translations, setTranslations] = useState({});
  const [audioUrl, setAudioUrl] = useState("");
  const [hoveredSentence, setHoveredSentence] = useState("");
  const [loading, setLoading] = useState(false);
  const audioRef = useRef(null);
  const audioCache = useRef({});

  const handleTextChange = (e) => {
    setText(e.target.value);
  };

  const handleSplitSentences = () => {
    const result = split(text);
    setSentences(
      result
        .map((sentence) => sentence.raw)
        .filter((item) => item.trim().length)
    );
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
          { sentence },
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
      const response = await axios.get(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
          sentence
        )}&langpair=en|zh`
      );
      const translation = response.data.responseData.translatedText;

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
    <div style={{ padding: "20px", width:"760px" }}>
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
