import { GoogleGenAI, Type } from "@google/genai";

export interface ExtractedImage {
  id: string;
  box: [number, number, number, number];
}

export interface ConversionResult {
  html: string;
  images: ExtractedImage[];
}

export async function convertPdfPageToHtml(imageBase64: string, pageNumber: number): Promise<ConversionResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `
    You are an expert in Web Accessibility (ADA/WCAG compliance).
    Your task is to convert the provided image of a PDF page into semantic, accessible HTML.
    
    Guidelines:
    1. Use semantic HTML5 tags (<header>, <main>, <section>, <article>, <aside>, <footer>).
    2. Maintain a logical heading hierarchy (h1, h2, h3, etc.).
    3. For any images, illustrations, or icons found:
       - Use a semantic <figure> and <figcaption> structure if appropriate.
       - ALWAYS provide a highly descriptive 'alt' attribute for the <img> tag.
       - For the 'src' attribute, use a unique identifier like 'img_0', 'img_1', etc.
       - You MUST also provide the bounding box for each image in the 'images' array in the JSON response.
    4. For tables, use <table>, <thead>, <tbody>, <tr>, and <th> with the 'scope' attribute.
    5. Ensure all interactive elements (if any) have proper ARIA labels.
    6. Do NOT include <html>, <head>, or <body> tags. Just the content for the page.
    7. Preserve the reading order of the document.
    8. Use clean Tailwind CSS classes for basic layout if needed, but prioritize semantic structure.
  `;

  const prompt = `Convert this PDF page (Page ${pageNumber}) into ADA-compliant accessible HTML. Identify any images and provide their bounding boxes [ymin, xmin, ymax, xmax] normalized to 0-1000.`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageBase64,
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          html: {
            type: Type.STRING,
            description: "The accessible HTML content. Use <img src='img_[index]' alt='...'> for images."
          },
          images: {
            type: Type.ARRAY,
            description: "List of images found on the page with their bounding boxes.",
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "The id of the image used in the HTML src, e.g., 'img_0'" },
                box: { 
                  type: Type.ARRAY, 
                  items: { type: Type.NUMBER },
                  description: "Bounding box [ymin, xmin, ymax, xmax] normalized to 0-1000"
                }
              },
              required: ["id", "box"]
            }
          }
        },
        required: ["html", "images"]
      }
    },
  });

  try {
    const text = response.text || "{}";
    return JSON.parse(text) as ConversionResult;
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return { html: "<!-- Error generating HTML -->", images: [] };
  }
}
