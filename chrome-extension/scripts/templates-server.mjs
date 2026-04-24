import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";

import { logStep, projectRoot } from "./lib.mjs";

const templatesDir = path.join(projectRoot, "templates");
const defaultPort = Number(process.env.INFOCUTTER_TEMPLATE_PORT ?? "41800");

function jsonResponse(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function normalizeRule(rule) {
  if (!rule || typeof rule !== "object" || typeof rule.selector !== "string") {
    return null;
  }

  return {
    frameScope: typeof rule.frameScope === "string" ? rule.frameScope : null,
    selector: rule.selector
  };
}

function normalizeCard(card) {
  if (!card || typeof card !== "object" || typeof card.id !== "string" || typeof card.name !== "string") {
    return null;
  }

  const rules = Array.isArray(card.rules)
    ? card.rules.map(normalizeRule).filter((item) => item !== null)
    : [];

  return {
    enabled: typeof card.enabled === "boolean" ? card.enabled : true,
    id: card.id,
    name: card.name,
    note: typeof card.note === "string" ? card.note : "",
    rules
  };
}

function normalizeTemplate(template) {
  if (!template || typeof template !== "object") {
    return null;
  }

  if (typeof template.slug !== "string" || typeof template.name !== "string") {
    return null;
  }

  const cards = Array.isArray(template.cards)
    ? template.cards.map(normalizeCard).filter((item) => item !== null)
    : [];
  const matchers = Array.isArray(template.matchers)
    ? template.matchers.filter((matcher) => typeof matcher === "string" && matcher.length > 0)
    : [];

  return {
    version: 1,
    slug: template.slug,
    name: template.name,
    description: typeof template.description === "string" ? template.description : "",
    matchers,
    cards
  };
}

async function ensureTemplatesDir() {
  await mkdir(templatesDir, { recursive: true });
}

function safeTemplateSlug(slug) {
  return String(slug).replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
}

function templateFilePath(slug) {
  return path.join(templatesDir, `${safeTemplateSlug(slug)}.json`);
}

async function readTemplateFile(fileName) {
  const raw = await readFile(path.join(templatesDir, fileName), "utf8");
  return normalizeTemplate(JSON.parse(raw));
}

async function readTemplateBySlug(slug) {
  try {
    const raw = await readFile(templateFilePath(slug), "utf8");
    return normalizeTemplate(JSON.parse(raw));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function listTemplates() {
  await ensureTemplatesDir();
  const entries = await readdir(templatesDir, { withFileTypes: true });
  const templates = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const template = await readTemplateFile(entry.name);
    if (!template) {
      continue;
    }

    templates.push({
      slug: template.slug,
      name: template.name,
      description: template.description,
      matcherCount: template.matchers.length,
      cardCount: template.cards.length,
      ruleCount: template.cards.reduce((total, card) => total + card.rules.length, 0)
    });
  }

  return templates.sort((left, right) => left.name.localeCompare(right.name));
}

async function writeTemplate(template, forcedSlug) {
  await ensureTemplatesDir();
  const normalized = normalizeTemplate(template);
  if (!normalized) {
    throw new Error("유효하지 않은 템플릿 형식입니다.");
  }

  const safeSlug = safeTemplateSlug(forcedSlug ?? normalized.slug);
  const filePath = templateFilePath(safeSlug);
  await writeFile(filePath, JSON.stringify({ ...normalized, slug: safeSlug }, null, 2), "utf8");
  return { ...normalized, slug: safeSlug };
}

async function deleteTemplate(slug) {
  try {
    await unlink(templateFilePath(slug));
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const server = http.createServer(async (request, response) => {
  try {
    if (!request.url) {
      jsonResponse(response, 400, { ok: false, error: "요청 URL이 없습니다." });
      return;
    }

    const url = new URL(request.url, `http://127.0.0.1:${defaultPort}`);

    if (request.method === "OPTIONS") {
      jsonResponse(response, 204, { ok: true });
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      jsonResponse(response, 200, { ok: true, templatesDir });
      return;
    }

    if (request.method === "GET" && url.pathname === "/templates") {
      jsonResponse(response, 200, { ok: true, templates: await listTemplates() });
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/templates/")) {
      const slug = url.pathname.replace("/templates/", "");
      const template = await readTemplateBySlug(slug);
      if (!template) {
        jsonResponse(response, 404, { ok: false, error: "템플릿을 찾을 수 없습니다." });
        return;
      }
      jsonResponse(response, 200, { ok: true, template });
      return;
    }

    if (request.method === "POST" && url.pathname === "/templates") {
      const body = await readBody(request);
      const payload = JSON.parse(body);
      const template = await writeTemplate(payload);
      jsonResponse(response, 201, { ok: true, template });
      return;
    }

    if (request.method === "PUT" && url.pathname.startsWith("/templates/")) {
      const slug = url.pathname.replace("/templates/", "");
      const body = await readBody(request);
      const payload = JSON.parse(body);
      const template = await writeTemplate({ ...payload, slug }, slug);
      jsonResponse(response, 200, { ok: true, template });
      return;
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/templates/")) {
      const slug = url.pathname.replace("/templates/", "");
      const deleted = await deleteTemplate(slug);
      if (!deleted) {
        jsonResponse(response, 404, { ok: false, error: "삭제할 템플릿을 찾을 수 없습니다." });
        return;
      }
      jsonResponse(response, 200, { ok: true, slug });
      return;
    }

    jsonResponse(response, 404, { ok: false, error: "지원하지 않는 경로입니다." });
  } catch (error) {
    jsonResponse(response, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "템플릿 서버 처리에 실패했습니다."
    });
  }
});

server.listen(defaultPort, "127.0.0.1", () => {
  logStep(`템플릿 서버 시작: http://127.0.0.1:${defaultPort}`);
  process.stdout.write(`templates dir: ${templatesDir}\n`);
});
