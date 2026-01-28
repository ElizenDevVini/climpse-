import { createWorker, type Worker } from 'tesseract.js';

export class OCRProcessor {
  private worker: Worker | null = null;

  async init(): Promise<void> {
    this.worker = await createWorker('eng');
  }

  async extractText(imagePath: string): Promise<string> {
    if (!this.worker) {
      await this.init();
    }

    try {
      const result = await this.worker!.recognize(imagePath);
      return result.data.text.trim();
    } catch (err) {
      console.error('OCR extraction failed:', (err as Error).message);
      return '';
    }
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}
