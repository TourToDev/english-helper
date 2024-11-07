import re
import spacy
from spacy import displacy

# Load SpaCy English model
nlp = spacy.load("en_core_web_sm")

# Function to clean OCR text
def clean_ocr_text(ocr_text):
    # Step 1: Remove unwanted line breaks within sentences
    cleaned_text = re.sub(r'(?<=\S)\n(?=\S)', ' ', ocr_text)  # remove line breaks between words
    cleaned_text = re.sub(r'(?<=\S)\n', ' ', cleaned_text)  # remove line breaks at end of lines

    # Step 2: Remove multiple spaces (OCR can introduce extra spaces between words)
    cleaned_text = re.sub(r' +', ' ', cleaned_text)

    # Step 3: Restore logical paragraph breaks (assuming double line breaks indicate paragraph)
    cleaned_text = re.sub(r'\n\n+', '\n\n', cleaned_text)  # normalize multiple paragraph breaks

    # Step 4: Optionally, remove special characters or artifacts
    cleaned_text = re.sub(r'[^\w\s,\.!?]', '', cleaned_text)  # keep only alphanumeric, space, punctuation

    return cleaned_text

# Function to segment text into sentences
def segment_text_into_sentences(cleaned_text):
    # Process the cleaned text with SpaCy for sentence segmentation
    doc = nlp(cleaned_text)
    
    # Extract sentences and combine them into structured text
    sentences = [sent.text.strip() for sent in doc.sents]
    structured_text = "\n".join(sentences)
    
    return structured_text

# Example OCR text (replace this with your actual OCR-extracted text)
ocr_text = """
rod. Whereas intensity is a physical measure of light energy, brightness is
 a measure of how intense we perceive the light emitted from an object to
 be. The human visual system does not have the same response to a
 monochromatic (single-frequency) red light as to a monochromatic green
 light. If these two lights were to emit the same energy, they would appear
 to us to have different brightness, because of the unequal response of the
 cones to red and green light. We are most sensitive to green light, and
 least sensitive to red and blue.
 Brightness is an overall measure of how we react to the intensity of light.
 Human color-vision capabilities are due to the different sensitivities of the
 three types of cones. The major consequence of having three types of
 cones is that, instead of having to work with all visible wavelengths
 individually, we can use three standard primaries to approximate any
 color that we can perceive. Consequently, most image production
 systems, including film and video, work with just three basic, or primary,
 colors. We discuss color in greater depth in Chapters 2 and 12 .
 
 
 The initial processing of light in the human visual system is based on the
 same principles used by most optical systems. However, the human visual
 system has a back end much more complex than that of a camera or
 telescope. The optic nerve is connected to the rods and cones in an
 extremely complex arrangement that has many of the characteristics of a
 sophisticated signal processor. The final processing is done in a part of
 the brain called the visual cortex, where high-level functions, such as
 object recognition, are carried out. We will omit any discussion of high
level processing; instead, we can think simply in terms of an image that is
 conveyed from the rods and cones to the brain.
"""

# Clean the OCR text
cleaned_text = clean_ocr_text(ocr_text)

# Segment the text into sentences
structured_text = segment_text_into_sentences(cleaned_text)

# Print the structured text
print(cleaned_text)
