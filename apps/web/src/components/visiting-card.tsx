"use client";

import React, { forwardRef } from "react";

export type CardDesign = {
  brand: string;
  title: string;
  subtitle: string;
  instructions: string;
  footer: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
};

export type CardCode = {
  id: string;
  label: string | null;
  url: string;
  qrDataUrl: string;
};

export const DEFAULT_CARD_DESIGN: CardDesign = {
  brand: "CONNECT ME",
  title: "Let's connect",
  subtitle: "Scan to share your contact details",
  instructions: "Use your phone camera to scan. No app required.",
  footer: "You share. We connect.",
  accentColor: "#6D28D9",
  backgroundColor: "#FFFFFF",
  textColor: "#111827",
};

function wrapText(value: string, limit: number, maxLines: number): string[] {
  const words = (value || "").trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    // URLs and custom words can be longer than a whole line, so split them safely.
    if (word.length > limit) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let offset = 0; offset < word.length; offset += limit) {
        lines.push(word.slice(offset, offset + limit));
      }
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > limit && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;

  const visible = lines.slice(0, maxLines);
  visible[maxLines - 1] = `${visible[maxLines - 1].replace(/[. …]+$/, "")}…`;
  return visible;
}

type TextBlockProps = {
  value: string;
  x: number;
  y: number;
  maxChars: number;
  maxLines: number;
  lineHeight: number;
  fontSize: number;
  fontWeight?: number;
  fill: string;
  opacity?: number;
  letterSpacing?: number;
};

function TextBlock({
  value,
  x,
  y,
  maxChars,
  maxLines,
  lineHeight,
  fontSize,
  fontWeight = 400,
  fill,
  opacity = 1,
  letterSpacing,
}: TextBlockProps) {
  const lines = wrapText(value, maxChars, maxLines);
  return (
    <text
      x={x}
      y={y}
      fill={fill}
      opacity={opacity}
      fontSize={fontSize}
      fontWeight={fontWeight}
      letterSpacing={letterSpacing}
      fontFamily="Arial, Helvetica, sans-serif"
    >
      {lines.map((line, index) => (
        <tspan key={`${index}-${line}`} x={x} dy={index === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

export type VisitingCardProps = {
  design: CardDesign;
  code: CardCode | null;
  className?: string;
};

/**
 * This is the canonical React component shown in the Card Studio's source tab.
 * The preview and exported assets use the same SVG structure, so downloads keep
 * the text, palette, QR, URL, borders and background instead of exporting a QR alone.
 */
export const VisitingCard = forwardRef<SVGSVGElement, VisitingCardProps>(
  function VisitingCard({ design, code, className }, ref) {
    const accent = design.accentColor || DEFAULT_CARD_DESIGN.accentColor;
    const background = design.backgroundColor || DEFAULT_CARD_DESIGN.backgroundColor;
    const text = design.textColor || DEFAULT_CARD_DESIGN.textColor;

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width="1200"
        height="720"
        viewBox="0 0 1200 720"
        role="img"
        aria-label={`Connect Me visiting card for ${code?.label || "default code"}`}
        className={className}
      >
        <rect x="0" y="0" width="1200" height="720" rx="32" fill={background} />
        <rect x="0" y="0" width="24" height="720" rx="12" fill={accent} />
        <rect x="24" y="0" width="1176" height="720" rx="32" fill="none" stroke={accent} strokeWidth="3" />
        <path d="M 80 132 H 1120" fill="none" stroke={accent} strokeOpacity="0.32" strokeWidth="2" />

        <TextBlock
          value={design.brand || "YOUR BRAND"}
          x={80}
          y={94}
          maxChars={36}
          maxLines={1}
          lineHeight={30}
          fontSize={30}
          fontWeight={800}
          fill={accent}
          letterSpacing={4}
        />
        <TextBlock
          value={code?.label || "Default QR card"}
          x={80}
          y={178}
          maxChars={44}
          maxLines={1}
          lineHeight={26}
          fontSize={22}
          fontWeight={700}
          fill={text}
        />

        <TextBlock
          value={design.title || "Let's connect"}
          x={80}
          y={270}
          maxChars={28}
          maxLines={2}
          lineHeight={58}
          fontSize={52}
          fontWeight={800}
          fill={text}
        />
        <TextBlock
          value={design.subtitle}
          x={80}
          y={376}
          maxChars={42}
          maxLines={2}
          lineHeight={30}
          fontSize={24}
          fontWeight={700}
          fill={text}
        />
        <TextBlock
          value={design.instructions}
          x={80}
          y={446}
          maxChars={50}
          maxLines={3}
          lineHeight={26}
          fontSize={18}
          fill={text}
          opacity={0.8}
        />
        {code?.url ? (
          <TextBlock
            value={code.url}
            x={80}
            y={548}
            maxChars={48}
            maxLines={2}
            lineHeight={20}
            fontSize={14}
            fill={text}
            opacity={0.72}
          />
        ) : (
          <TextBlock
            value="Select or generate a code to preview its unique URL."
            x={80}
            y={548}
            maxChars={48}
            maxLines={2}
            lineHeight={20}
            fontSize={14}
            fill={text}
            opacity={0.72}
          />
        )}

        <rect x="820" y="154" width="300" height="300" rx="24" fill="#FFFFFF" stroke={accent} strokeOpacity="0.5" strokeWidth="3" />
        {code?.qrDataUrl ? (
          <image href={code.qrDataUrl} x="840" y="174" width="260" height="260" preserveAspectRatio="xMidYMid meet" />
        ) : (
          <>
            <rect x="848" y="182" width="244" height="244" rx="12" fill="#F8FAFC" stroke="#CBD5E1" strokeDasharray="10 8" strokeWidth="3" />
            <text x="970" y="293" textAnchor="middle" fill="#64748B" fontSize="22" fontWeight="700" fontFamily="Arial, Helvetica, sans-serif">QR PREVIEW</text>
            <text x="970" y="326" textAnchor="middle" fill="#64748B" fontSize="16" fontFamily="Arial, Helvetica, sans-serif">Select a code</text>
          </>
        )}
        <rect x="864" y="478" width="212" height="46" rx="23" fill={accent} />
        <text x="970" y="507" textAnchor="middle" fill="#FFFFFF" fontSize="17" fontWeight="800" letterSpacing="2" fontFamily="Arial, Helvetica, sans-serif">SCAN TO CONNECT</text>

        <path d="M 80 625 H 1120" fill="none" stroke={accent} strokeOpacity="0.32" strokeWidth="2" />
        <TextBlock
          value={design.footer}
          x={80}
          y={670}
          maxChars={68}
          maxLines={1}
          lineHeight={20}
          fontSize={18}
          fontWeight={700}
          fill={accent}
        />
        <rect x="1000" y="74" width="120" height="34" rx="17" fill={accent} fillOpacity="0.1" stroke={accent} strokeOpacity="0.45" strokeWidth="2" />
        <text x="1060" y="96" textAnchor="middle" fill={accent} fontSize="13" fontWeight="800" letterSpacing="1.5" fontFamily="Arial, Helvetica, sans-serif">SINGLE-USE</text>
      </svg>
    );
  }
);
