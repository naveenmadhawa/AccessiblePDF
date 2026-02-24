import express from "express";
import { createServer as createViteServer } from "vite";
import puppeteer from "puppeteer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for large HTML strings
  app.use(express.json({ limit: '50mb' }));

  // API route to generate PDF
  app.post("/api/pdf", async (req, res) => {
    const { html, filename } = req.body;
    
    if (!html) {
      return res.status(400).json({ error: "HTML content is required" });
    }

    let browser;
    try {
      browser = await puppeteer.launch({ 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
      });
      const page = await browser.newPage();
      
      // Set the content and wait for network idle to ensure images are loaded
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Generate PDF with accessibility tags enabled
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
        tagged: true, // This enables accessibility tags in the PDF
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename || 'document.pdf'}"`);
      res.send(Buffer.from(pdfBuffer));
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
