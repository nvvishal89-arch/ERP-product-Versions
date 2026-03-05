
export interface DxfEntity {
  type: 'LINE' | 'CIRCLE' | 'TEXT' | 'ARC';
  layer?: string;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  cx?: number;
  cy?: number;
  r?: number;
  text?: string;
  height?: number;
  startAngle?: number;
  endAngle?: number;
}

export class DxfGenerator {
  private content: string = '';

  constructor() {
    this.header();
  }

  private header() {
    // AC1015 is AutoCAD 2000 format
    this.content += '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n';
    this.content += '0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLTYPE\n70\n1\n0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n0\nENDTAB\n0\nTABLE\n2\nLAYER\n70\n1\n0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n0\nENDTAB\n0\nENDSEC\n';
    this.content += '0\nSECTION\n2\nENTITIES\n';
  }

  private validate(val: number): number {
    if (isNaN(val) || !isFinite(val)) return 0;
    // Limit coordinates to reasonable range to prevent AutoCAD issues
    return Math.max(-1000000, Math.min(1000000, val));
  }

  addLine(x1: number, y1: number, x2: number, y2: number, layer: string = '0') {
    x1 = this.validate(x1);
    y1 = this.validate(y1);
    x2 = this.validate(x2);
    y2 = this.validate(y2);
    this.content += `0\nLINE\n8\n${layer}\n10\n${x1}\n20\n${y1}\n30\n0.0\n11\n${x2}\n21\n${y2}\n31\n0.0\n`;
  }

  addCircle(cx: number, cy: number, r: number, layer: string = '0') {
    cx = this.validate(cx);
    cy = this.validate(cy);
    r = Math.max(0.001, this.validate(r)); // Radius must be positive
    this.content += `0\nCIRCLE\n8\n${layer}\n10\n${cx}\n20\n${cy}\n30\n0.0\n40\n${r}\n`;
  }

  addText(x: number, y: number, text: string, height: number = 5, layer: string = '0') {
    x = this.validate(x);
    y = this.validate(y);
    height = Math.max(0.1, this.validate(height));
    const safeText = (text || '').substring(0, 255).replace(/\n/g, ' ');
    this.content += `0\nTEXT\n8\n${layer}\n10\n${x}\n20\n${y}\n30\n0.0\n40\n${height}\n1\n${safeText}\n`;
  }

  generate(): string {
    return this.content + '0\nENDSEC\n0\nEOF\n';
  }
}
