const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

async function request(path, options = {}) {
  const { headers, ...rest } = options;
  // Для FormData (загрузка файла) Content-Type нельзя проставлять вручную —
  // fetch сам должен посчитать multipart-границу (boundary).
  const isFormData = typeof FormData !== "undefined" && rest.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: isFormData ? { ...headers } : { "Content-Type": "application/json", ...headers },
    ...rest,
  });

  if (!response.ok) {
    let message = `Ошибка запроса (${response.status})`;
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      // тело ответа могло быть пустым — оставляем сообщение по умолчанию
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Поиск инструкций — вся логика поиска выполняется на сервере,
 * клиент лишь передаёт текст запроса и номер страницы.
 */
export function searchInstructions({
  query = "",
  page = 1,
  pageSize = 11,
  sort
} = {}) {

  const currentSort =
    sort ||
    (
      typeof window !== "undefined" &&
      new URLSearchParams(
        window.location.search
      ).get("sort") ===
        "popular"
        ? "popular"
        : "newest"
    );


  const params =
    new URLSearchParams({
      q:
        query,

      page:
        String(page),

      pageSize:
        String(pageSize),

      sort:
        currentSort
    });


  return request(
    `/api/instructions?${params.toString()}`
  );

}

export function getInstruction(id) {
  return request(`/api/instructions/${encodeURIComponent(id)}`);
}

/** Просит сервер сгенерировать недостающую инструкцию через YandexGPT. Только для админа. */
export function generateInstruction(profession, token) {
  return request(`/api/instructions/generate`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ profession }),
  });
}

/**
 * Загружает собственную инструкцию админа — файлом (pdf/docx/txt/md) или
 * текстом вручную. formData должен содержать поля title, profession и
 * либо file, либо content. Только для админа.
 */
export function uploadInstruction(formData, token) {
  return request(`/api/instructions/upload`, {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });
}

/** Удаляет инструкцию. Только для админа. */
export function getGenerationStats(token) {
  return request(
    "/api/instructions/generation-stats",
    {
      headers: authHeaders(token)
    }
  );
}

export function deleteInstruction(id, token) {
  return request(`/api/instructions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}



export function updateInstruction(
  id,
  instruction,
  token
) {

  return request(
    `/api/instructions/${encodeURIComponent(id)}`,
    {
      method: "PUT",

      headers:
        authHeaders(token),

      body:
        JSON.stringify(
          instruction
        )
    }
  );

}


export function recordInstructionView(
  id
) {

  return request(
    `/api/instructions/${encodeURIComponent(id)}/view`,
    {
      method:
        "POST"
    }
  );

}


export function getInstructionViews(
  id,
  token
) {

  return request(
    `/api/instructions/${encodeURIComponent(id)}/views`,
    {
      headers:
        authHeaders(token)
    }
  );

}


export function getInstructionHistory(
  id,
  token
) {

  return request(
    `/api/instructions/${encodeURIComponent(id)}/history`,
    {
      headers:
        authHeaders(token)
    }
  );

}


export function rollbackInstruction(
  id,
  token
) {

  return request(
    `/api/instructions/${encodeURIComponent(id)}/rollback`,
    {
      method:
        "POST",

      headers:
        authHeaders(token)
    }
  );

}



/**
 * ============================================================
 * BULK IMPORT
 * ============================================================
 *
 * Файловый массовый импорт.
 *
 * Один batch может содержать тысячи документов,
 * но сами файлы отправляются небольшими HTTP-пакетами.
 */

export function createBulkImport(
  total,
  token
) {
  return request(
    "/api/instructions/import-batches",
    {
      method: "POST",

      headers:
        authHeaders(token),

      body:
        JSON.stringify({
          total
        })
    }
  );
}


export function uploadBulkImportChunk(
  batchId,
  files,
  token
) {
  const formData =
    new FormData();

  for (const file of files) {
    formData.append(
      "files",
      file
    );
  }

  return request(
    `/api/instructions/import-batches/${encodeURIComponent(batchId)}/files`,
    {
      method: "POST",

      headers:
        authHeaders(token),

      body:
        formData
    }
  );
}


export function startBulkImport(
  batchId,
  token
) {
  return request(
    `/api/instructions/import-batches/${encodeURIComponent(batchId)}/start`,
    {
      method: "POST",

      headers:
        authHeaders(token)
    }
  );
}


export function getBulkImportProgress(
  batchId,
  token
) {
  return request(
    `/api/instructions/import-batches/${encodeURIComponent(batchId)}`,
    {
      headers:
        authHeaders(token)
    }
  );
}


export function getBulkImportFiles(
  batchId,
  token,
  {
    status = "",
    offset = 0,
    limit = 100
  } = {}
) {
  const params =
    new URLSearchParams();

  if (status) {
    params.set(
      "status",
      status
    );
  }

  params.set(
    "offset",
    String(offset)
  );

  params.set(
    "limit",
    String(limit)
  );

  return request(
    `/api/instructions/import-batches/${encodeURIComponent(batchId)}/files?${params.toString()}`,
    {
      headers:
        authHeaders(token)
    }
  );
}


export function stopBulkImport(
  batchId,
  token
) {
  return request(
    `/api/instructions/import-batches/${encodeURIComponent(batchId)}/stop`,
    {
      method: "POST",

      headers:
        authHeaders(token)
    }
  );
}


export function resumeBulkImport(
  batchId,
  token
) {
  return request(
    `/api/instructions/import-batches/${encodeURIComponent(batchId)}/resume`,
    {
      method: "POST",

      headers:
        authHeaders(token)
    }
  );
}
