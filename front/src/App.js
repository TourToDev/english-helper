import React, { useState, useRef } from "react";
import { Input, Button, message, Select, Checkbox, Spin } from "antd";
import axios from "axios";
import { GlobalOutlined } from "@ant-design/icons";
import voices from "./constants/voicesList";
import "./App.css";

const { Option } = Select;

const App = () => {
  const [text, setText] = useState("");
  const [sentences, setSentences] = useState([]);
  const [translations, setTranslations] = useState({});
  const [hoveredSentence, setHoveredSentence] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSentences, setLoadingSentences] = useState({}); // New state for loading sentences
  const audioRef = useRef(null);
  const [selectedVoice, setSelectedVoice] = useState("en-US-JennyNeural");
  const [sequentialPlay, setSequentialPlay] = useState(false);
  const audioCache = useRef({});
  const currentIndexRef = useRef(0);

  const handleTextChange = (e) => setText(e.target.value);
  const handleVoiceChange = (value) => setSelectedVoice(value);
  const handleSequentialToggle = (e) => setSequentialPlay(e.target.checked);

  const handleSplitSentences = async () => {
    const response = await axios.post("http://127.0.0.1:5000/splitSentence", {
      passage: text,
    });
    const newSentences = response.data.filter((i) => i.trim().length);
    setSentences(newSentences);
    setTranslations({});
    
    // Preload audio if sequential play is enabled
    if (sequentialPlay) {
      preloadAudio(newSentences);
    }
  };

  const preloadAudio = async (sentencesToPreload) => {
    const newLoadingSentences = {};
    setLoadingSentences({}); // Reset loading states

    for (const sentence of sentencesToPreload) {
      newLoadingSentences[sentence] = true; // Set loading state for this sentence
      try {
        const response = await axios.post(
          "http://127.0.0.1:5000/getAudioFromSentence",
          { sentence, voice: selectedVoice },
          { responseType: "blob" }
        );
        const url = URL.createObjectURL(new Blob([response.data], { type: "audio/mp3" }));
        audioCache.current[sentence] = url;
      } catch (error) {
        message.error(`Error generating audio for sentence: ${sentence}`);
      }
      newLoadingSentences[sentence] = false; // Mark loading as finished
    }

    setLoadingSentences(newLoadingSentences); // Update loading states
  };

  const handleSentenceClick = async (sentence, index) => {
    if (loading || loadingSentences[sentence]) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    currentIndexRef.current = index;
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
        const url = URL.createObjectURL(new Blob([response.data], { type: "audio/mp3" }));
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
    if (sequentialPlay) {
      audioRef.current.onended = handlePlayNext;
    }
  };

  const handlePlayNext = () => {
    if (currentIndexRef.current + 1 < sentences.length) {
      currentIndexRef.current += 1;
      handleSentenceClick(sentences[currentIndexRef.current], currentIndexRef.current);
    } else {
      message.success("Reached the end of selected sentences.");
    }
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
        { sentence: text, voice: selectedVoice },
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(new Blob([response.data], { type: "audio/mp3" }));

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

  const handleStreamingReadClick = async () => {
    if (!text) {
      message.warning("Please enter a paragraph to stream.");
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    setLoading(true);
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createBufferSource();
    source.connect(audioContext.destination);

    try {
      const response = await fetch("http://127.0.0.1:5000/getStreamingAudioFromSentence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ sentence: text, voice: selectedVoice })
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const reader = response.body.getReader();
      const audioChunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        audioChunks.push(value);
      }

      const audioBlob = new Blob(audioChunks, { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(audioBlob);

      audioRef.current = new Audio(audioUrl);
      audioRef.current.play();

      audioRef.current.onended = () => {
        setLoading(false);
      };
    } catch (error) {
      message.error("Error in streaming audio.");
      setLoading(false);
    }
  };

  const renderHighlightedPassage = () => {
    return sentences.map((sentence, index) => (
      <div key={index} style={{ marginBottom: "10px" }}>
        <span
          onMouseEnter={() => setHoveredSentence(sentence)}
          onMouseLeave={() => setHoveredSentence("")}
          onClick={() => handleSentenceClick(sentence, index)}
          className={
            hoveredSentence === sentence || currentIndexRef.current === index
              ? "highlight"
              : ""
          }
          style={{ cursor: "pointer", display: "block" }}
        >
          {loadingSentences[sentence] ? (
            <Spin size="small" style={{ marginRight: "8px" }} />
          ) : null}
          {sentence}
          <GlobalOutlined
            style={{ marginLeft: "8px", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
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
    <div className="break-reader" style={{ padding: "20px", width: "760px" }}>
      <Select
        style={{ width: 250, marginBottom: "10px" }}
        defaultValue={selectedVoice}
        onChange={handleVoiceChange}
      >
        {voices.map((voice) => (
          <Option key={voice.value} value={voice.value}>
            {voice.label}
          </Option>
        ))}
      </Select>
      <Checkbox
        style={{ marginBottom: "10px", marginLeft: "10px" }}
        onChange={handleSequentialToggle}
      >
        Enable Sequential Reading
      </Checkbox>
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
      >
        Read All
      </Button>
      <Button
        type="default"
        onClick={handleStreamingReadClick}
        style={{ marginTop: "10px", marginLeft: "10px" }}
      >
        Stream Read
      </Button>
      <div style={{ marginTop: "20px" }}>
        {renderHighlightedPassage()}
      </div>
    </div>
  );
};

export default App;
