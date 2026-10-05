import {
  Router
} from "express";

import {
  createPublicGenerationOrder,
  getPublicGenerationOrder,
  getPublicGenerationOrderView,
  updatePublicGenerationOrder,
  findPublicGenerationOrderByTransactionId,
  listPublicGenerationOrdersByOwner,
  getPublicGenerationOrderByOwnerView,
  listPublicationInboxOrders,
  PUBLIC_GENERATION_PRICE_RUB,
  PUBLIC_GENERATION_CURRENCY
} from "../services/publicGenerationOrderService.js";

import {
  instructionsRepository
} from "../services/instructionsRepository.js";

import {
  createInstructionPdfBuffer
} from "../services/instructionPdfService.js";


import {
  normalizeProfessionKey
} from "../services/professionNormalizer.js";

import {
  queuePublicGenerationOrder
} from "../services/publicPaidGenerationService.js";

import {
  getCloudPaymentsTransaction
} from "../services/cloudPaymentsApiService.js";

import {
  requireAdmin
} from "../middleware/auth.js";

import {
  resolvePromoCode,
  markPromoCodeUsed
} from "../services/promoCodeService.js";


export const publicGenerationRouter =
  Router();


/*
 * В платном генераторе больше нет
 * редакционной фильтрации профессии.
 */
function normalizeRequestedProfession(
  value
) {

  const profession =
    String(
      value ??
      ""
    )
    .replace(
      /\s+/gu,
      " "
    )
    .trim();


  if (!profession) {

    return {
      ok:
        false,

      error:
        "Укажите профессию или вид работ."
    };

  }


  if (
    profession.length >
      240
  ) {

    return {
      ok:
        false,

      error:
        "Название слишком длинное."
    };

  }


  return {
    ok:
      true,

    profession
  };
}


function findExistingInstruction(
  profession
) {

  const professionKey =
    normalizeProfessionKey(
      profession
    );


  if (!professionKey) {
    return null;
  }


  if (
    typeof
      instructionsRepository
        .findByProfessionKey ===
    "function"
  ) {

    return (
      instructionsRepository
        .findByProfessionKey(
          professionKey
        ) ||
      null
    );

  }


  return null;
}


/*
 * ============================================================
 * VALIDATE
 * ============================================================
 */
publicGenerationRouter.post(
  "/validate",

  (req, res) => {

    const validation =
      normalizeRequestedProfession(
        req.body?.profession
      );


    if (!validation.ok) {

      return res
        .status(422)
        .json({
          allowed:
            false,

          error:
            validation.error
        });

    }


    const profession =
      validation.profession;


    const existing =
      findExistingInstruction(
        profession
      );


    return res.json({
      allowed:
        true,

      profession,

      amount:
        PUBLIC_GENERATION_PRICE_RUB,

      currency:
        PUBLIC_GENERATION_CURRENCY,

      existingInstructionId:
        existing?.id ??
        null
    });

  }
);


/*
 * ============================================================
 * CREATE ORDER
 * ============================================================
 */
publicGenerationRouter.post(
  "/orders",

  (req, res) => {

    /*
     * ACCOUNT PURCHASE OWNERSHIP
     *
     * Платный заказ нельзя создать анонимно.
     * Иначе после оплаты его невозможно надёжно
     * связать с личным кабинетом пользователя.
     */
    if (
      !req.user ||
      req.user.role !== "user" ||
      !req.user.sub
    ) {

      return res
        .status(401)
        .json({
          code:
            "AUTH_REQUIRED",

          error:
            "Для покупки инструкции необходимо войти в аккаунт или зарегистрироваться."
        });

    }


    const validation =
      normalizeRequestedProfession(
        req.body?.profession
      );


    if (!validation.ok) {

      return res
        .status(422)
        .json({
          error:
            validation.error
        });

    }


    const profession =
      validation.profession;


    /*
     * Уже опубликованную инструкцию
     * повторно не продаём.
     */
    const existing =
      findExistingInstruction(
        profession
      );


    if (existing) {

      return res
        .status(409)
        .json({
          error:
            "Инструкция уже доступна на сайте.",

          existingInstructionId:
            existing.id
        });

    }


    const rawPromoCode =
      String(
        req.body?.promoCode ??
        ""
      )
      .trim();


    let pricing = {
      originalAmount:
        PUBLIC_GENERATION_PRICE_RUB,

      amount:
        PUBLIC_GENERATION_PRICE_RUB,

      promo:
        null
    };


    if (rawPromoCode) {

      const promoResult =
        resolvePromoCode(
          rawPromoCode,
          PUBLIC_GENERATION_PRICE_RUB
        );


      if (!promoResult.ok) {

        return res
          .status(422)
          .json({
            code:
              promoResult.code,

            error:
              promoResult.error
          });

      }


      pricing = {
        originalAmount:
          promoResult.originalAmount,

        amount:
          promoResult.amount,

        promo: {
          ...promoResult.promo,

          discountAmount:
            promoResult.discountAmount
        }
      };

    }


    const owner =
      (
        req.user?.role ===
          "user" &&
        req.user?.sub
      )
        ? {
            userId:
              String(
                req.user.sub
              ),

            email:
              String(
                req.user.email ??
                req.user.login ??
                ""
              )
          }
        : null;


    const order =
      createPublicGenerationOrder(
        profession,
        pricing,
        owner
      );


    return res
      .status(201)
      .json({
        orderId:
          order.id,

        orderToken:
          order.accessToken,

        externalId:
          order.id,

        profession:
          order.profession,

        originalAmount:
          order.originalAmount ??
          order.amount,

        amount:
          order.amount,

        promo:
          order.promo
            ? {
                code:
                  order.promo.code,

                type:
                  order.promo.type,

                value:
                  order.promo.value,

                discountAmount:
                  order.promo.discountAmount
              }
            : null,

        currency:
          order.currency,

        publicTerminalId:
          String(
            process.env
              .CLOUDPAYMENTS_PUBLIC_ID ??
            ""
          ),

        expiresAt:
          order.expiresAt
      });

  }
);


/*
 * ============================================================
 * CONFIRM PAYMENT DIRECTLY THROUGH CLOUDPAYMENTS API
 * ============================================================
 *
 * Не доверяем результату браузера.
 *
 * Frontend передаёт только transactionId,
 * после чего SERVER самостоятельно получает
 * транзакцию через CloudPayments /payments/get.
 */
publicGenerationRouter.post(
  "/orders/:id/confirm-payment",

  async (req, res) => {

    const accessToken =
      String(
        req.get(
          "x-order-token"
        ) ??
        ""
      );


    /*
     * Сначала проверяем секретный token заказа.
     */
    const authorizedView =
      getPublicGenerationOrderView(
        req.params.id,
        accessToken
      );


    if (!authorizedView) {

      return res
        .status(404)
        .json({
          error:
            "Заказ не найден"
        });
    }


    const order =
      getPublicGenerationOrder(
        req.params.id
      );


    if (!order) {

      return res
        .status(404)
        .json({
          error:
            "Заказ не найден"
        });
    }


    const rawTransactionId =
      String(
        req.body?.transactionId ??
        ""
      )
      .trim();


    if (
      !/^\d{1,20}$/u
        .test(
          rawTransactionId
        )
    ) {

      return res
        .status(400)
        .json({
          error:
            "Некорректный идентификатор платежа."
        });
    }


    const transactionIdNumber =
      Number(
        rawTransactionId
      );


    if (
      !Number.isSafeInteger(
        transactionIdNumber
      ) ||
      transactionIdNumber <= 0
    ) {

      return res
        .status(400)
        .json({
          error:
            "Некорректный идентификатор платежа."
        });
    }


    const transactionId =
      String(
        transactionIdNumber
      );


    /*
     * Один заказ не может внезапно получить
     * другой TransactionId.
     */
    if (
      order.transactionId &&
      String(
        order.transactionId
      ) !==
        transactionId
    ) {

      console.warn(
        "[PublicGeneration Confirm] transaction changed:",
        order.id
      );


      return res
        .status(409)
        .json({
          error:
            "Платёж не соответствует заказу."
        });
    }


    /*
     * Один TransactionId нельзя использовать
     * для двух разных заказов.
     */
    const transactionOwner =
      findPublicGenerationOrderByTransactionId(
        transactionId
      );


    if (
      transactionOwner &&
      transactionOwner.id !==
        order.id
    ) {

      console.warn(
        "[PublicGeneration Confirm] transaction reuse:",
        transactionId
      );


      return res
        .status(409)
        .json({
          error:
            "Платёж уже связан с другим заказом."
        });
    }


    /*
     * Идемпотентность:
     * повторный confirm уже принятого платежа
     * ничего не ломает.
     */
    if (
      order.transactionId &&
      String(
        order.transactionId
      ) ===
        transactionId &&
      [
        "paid",
        "generating",
        "generated",
          "published",
        "test_paid",
        "manual_review"
      ].includes(
        order.status
      )
    ) {

      if (
        order.status ===
          "paid" ||
        order.status ===
          "generating"
      ) {

        queuePublicGenerationOrder(
          order.id
        );
      }


      return res.json(
        getPublicGenerationOrderView(
          order.id,
          accessToken
        )
      );
    }


    let transaction;


    try {

      transaction =
        await getCloudPaymentsTransaction(
          transactionIdNumber
        );

    }
    catch(error) {

      console.error(
        "[PublicGeneration Confirm] CloudPayments API:",
        error?.code ||
          error?.message ||
          error
      );


      return res
        .status(502)
        .json({
          error:
            "Не удалось проверить платёж. Повторите проверку через несколько секунд."
        });
    }


    if (!transaction) {

      return res
        .status(409)
        .json({
          error:
            "CloudPayments пока не подтвердил платёж."
        });
    }


    const configuredPublicId =
      String(
        process.env
          .CLOUDPAYMENTS_PUBLIC_ID ??
        ""
      )
      .trim();


    const amount =
      Number(
        transaction.Amount
      );


    const amountMatches =
      Number.isFinite(
        amount
      ) &&
      Math.abs(
        amount -
        Number(
          order.amount
        )
      ) <
        0.0001;


    const transactionMatches =
      String(
        transaction.TransactionId ??
        ""
      ) ===
        transactionId;


    const terminalMatches =
      String(
        transaction.PublicId ??
        ""
      ) ===
        configuredPublicId;


    const invoiceMatches =
      String(
        transaction.InvoiceId ??
        ""
      ) ===
        order.id;


    const currencyMatches =
      String(
        transaction.Currency ??
        ""
      )
      .toUpperCase() ===
        String(
          order.currency
        )
        .toUpperCase();


    const statusMatches =
      String(
        transaction.Status ??
        ""
      ) ===
        "Completed";


    const notRefunded =
      transaction.Refunded !==
        true;


    if (
      !transactionMatches ||
      !terminalMatches ||
      !invoiceMatches ||
      !amountMatches ||
      !currencyMatches ||
      !statusMatches ||
      !notRefunded
    ) {

      console.warn(
        "[PublicGeneration Confirm] payment mismatch:",
        {
          orderId:
            order.id,

          transactionId,

          transactionMatches,

          terminalMatches,

          invoiceMatches,

          amountMatches,

          currencyMatches,

          status:
            String(
              transaction.Status ??
              ""
            ),

          refunded:
            transaction.Refunded ===
              true
        }
      );


      return res
        .status(409)
        .json({
          error:
            "Параметры платежа не соответствуют заказу."
        });
    }


    const paidAt =
      new Date()
        .toISOString();


    /*
     * Тестовую транзакцию принимаем,
     * но по умолчанию НЕ публикуем.
     */
    if (
      transaction.TestMode ===
        true &&
      process.env
        .PUBLIC_GENERATION_PUBLISH_TEST_PAYMENTS !==
        "1"
    ) {

      updatePublicGenerationOrder(
        order.id,
        {
          status:
            "test_paid",

          transactionId,

          paidAt,

          failureCode:
            null,

          internalError:
            null
        }
      );


      if (
        order.promo?.id
      ) {

        markPromoCodeUsed(
          order.promo.id,
          order.id
        );

      }


      console.log(
        "[PublicGeneration Confirm] test payment:",
        order.id,
        transactionId
      );


      return res.json(
        getPublicGenerationOrderView(
          order.id,
          accessToken
        )
      );
    }


    updatePublicGenerationOrder(
      order.id,
      {
        status:
          "paid",

        transactionId,

        paidAt,

        failureCode:
          null,

        internalError:
          null
      }
    );


    if (
      order.promo?.id
    ) {

      markPromoCodeUsed(
        order.promo.id,
        order.id
      );

    }


    /*
     * Генерация запускается ТОЛЬКО после
     * серверной проверки CloudPayments.
     */
    queuePublicGenerationOrder(
      order.id
    );


    console.log(
      "[PublicGeneration Confirm] payment confirmed:",
      order.id,
      transactionId
    );


    return res.json(
      getPublicGenerationOrderView(
        order.id,
        accessToken
      )
    );
  }
);


/*
 * ============================================================
 * USER ACCOUNT ORDERS
 * ============================================================
 */

function requireUserAccount(
  req,
  res,
  next
) {

  if (
    !req.user ||
    req.user.role !==
      "user" ||
    !req.user.sub
  ) {

    return res
      .status(401)
      .json({
        error:
          "Требуется авторизация пользователя"
      });

  }


  return next();

}


publicGenerationRouter.get(
  "/my-orders",

  requireUserAccount,

  (
    req,
    res
  ) => {

    return res.json({
      items:
        listPublicGenerationOrdersByOwner(
          req.user.sub
        )
    });

  }
);


publicGenerationRouter.get(
  "/my-orders/:id",

  requireUserAccount,

  (
    req,
    res
  ) => {

    const order =
      getPublicGenerationOrderByOwnerView(
        req.params.id,
        req.user.sub
      );


    /*
     * Намеренно одинаковый 404 и для чужого заказа,
     * и для несуществующего.
     */
    if (!order) {

      return res
        .status(404)
        .json({
          error:
            "Заказ не найден"
        });

    }


    return res.json(
      order
    );

  }
);



/*
 * ============================================================
 * USER ACCOUNT PDF
 * ============================================================
 */
publicGenerationRouter.get(
  "/my-orders/:id/pdf",

  requireUserAccount,

  async (
    req,
    res
  ) => {

    const order =
      getPublicGenerationOrderByOwnerView(
        req.params.id,
        req.user.sub
      );


    /*
     * Не раскрываем существование чужого заказа.
     */
    if (!order) {

      return res
        .status(404)
        .json({
          error:
            "Заказ не найден"
        });

    }


    let instruction =
      order.instruction ??
      null;


    /*
     * Если приватной копии уже нет,
     * но документ опубликован —
     * используем опубликованную версию.
     */
    if (
      !instruction &&
      order.instructionId
    ) {

      instruction =
        instructionsRepository
          .getById(
            order.instructionId
          );

    }


    if (!instruction) {

      return res
        .status(409)
        .json({
          error:
            "Инструкция ещё не готова"
        });

    }


    try {

      const pdf =
        await createInstructionPdfBuffer(
          instruction
        );


      const safeOrderId =
        String(
          order.id ??
          "order"
        )
        .replace(
          /[^a-zA-Z0-9_-]+/g,
          "-"
        )
        .slice(
          0,
          100
        );


      res.set(
        "Content-Type",
        "application/pdf"
      );

      res.set(
        "Content-Disposition",
        `attachment; filename="instruction-${safeOrderId}.pdf"`
      );

      res.set(
        "Cache-Control",
        "private, no-store"
      );


      return res
        .status(200)
        .send(
          pdf
        );

    }
    catch(error) {

      console.error(
        "[Account PDF]",
        order.id,
        error
      );


      return res
        .status(500)
        .json({
          error:
            "Не удалось сформировать PDF"
        });

    }

  }
);



/*
 * ============================================================
 * ADMIN_PUBLICATION_ROUTES_V2
 * ============================================================
 */

publicGenerationRouter.get(
  "/admin/inbox",

  requireAdmin,

  (req, res) => {

    return res.json({
      items:
        listPublicationInboxOrders()
    });

  }
);



/*
 * ============================================================
 * ADMIN EDIT GENERATED INSTRUCTION
 * ============================================================
 *
 * Сохраняет правки инструкции внутри заявки.
 * Публикация при этом НЕ выполняется.
 */
publicGenerationRouter.put(
  "/admin/orders/:id/instruction",

  requireAdmin,

  (req, res) => {

    const order =
      getPublicGenerationOrder(
        req.params.id
      );

    if (!order) {
      return res
        .status(404)
        .json({
          error:
            "Заказ не найден"
        });
    }

    if (
      order.status !==
        "generated" ||
      !order.generatedInstruction
    ) {
      return res
        .status(409)
        .json({
          error:
            "Инструкция ещё не готова."
        });
    }

    if (
      order.publicationStatus !==
        "pending"
    ) {
      return res
        .status(409)
        .json({
          error:
            "Редактировать можно только инструкцию, ожидающую публикации."
        });
    }

    const instruction =
      req.body?.instruction;

    if (
      !instruction ||
      typeof instruction !==
        "object" ||
      Array.isArray(instruction)
    ) {
      return res
        .status(400)
        .json({
          error:
            "Инструкция не передана."
        });
    }

    const title =
      String(
        instruction.title ?? ""
      ).trim();

    if (!title) {
      return res
        .status(400)
        .json({
          error:
            "Название инструкции не может быть пустым."
        });
    }

    if (
      !Array.isArray(
        instruction.sections
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Разделы инструкции должны быть массивом."
        });
    }

    const sections =
      instruction.sections.map(
        (
          section,
          sectionIndex
        ) => ({
          ...section,

          number:
            section?.number ??
            sectionIndex + 1,

          heading:
            String(
              section?.heading ?? ""
            ),

          paragraphs:
            Array.isArray(
              section?.paragraphs
            )
              ?
                section.paragraphs.map(
                  paragraph =>
                    String(
                      paragraph ?? ""
                    )
                )
              :
                []
        })
      );

    const editedInstruction = {
      ...order.generatedInstruction,
      ...instruction,

      /*
       * Эти поля нельзя поменять
       * через frontend-редактор.
       */
      id:
        order.generatedInstruction.id,

      profession:
        order.generatedInstruction
          .profession,

      title,

      sections,

      updatedAt:
        new Date()
          .toISOString()
    };

    const updatedOrder =
      updatePublicGenerationOrder(
        order.id,
        {
          generatedInstruction:
            editedInstruction
        }
      );

    if (!updatedOrder) {
      return res
        .status(500)
        .json({
          error:
            "Не удалось сохранить изменения."
        });
    }

    console.log(
      "[PublicGeneration Admin] draft edited:",
      order.id
    );

    return res.json({
      ok:
        true,

      orderId:
        order.id,

      publicationStatus:
        updatedOrder
          .publicationStatus,

      instruction:
        updatedOrder
          .generatedInstruction
    });
  }
);


publicGenerationRouter.post(
  "/admin/orders/:id/approve",

  requireAdmin,

  (req, res) => {

    const order =
      getPublicGenerationOrder(
        req.params.id
      );


    if (!order) {

      return res
        .status(404)
        .json({
          error:
            "Заказ не найден"
        });

    }


    if (
      order.status !==
        "generated" ||
      !order.generatedInstruction
    ) {

      return res
        .status(409)
        .json({
          error:
            "Инструкция ещё не готова."
        });

    }


    if (
      order.publicationStatus ===
        "published"
    ) {

      return res.json({
        ok:
          true,

        orderId:
          order.id,

        publicationStatus:
          "published",

        instructionId:
          order.instructionId
      });

    }


    if (
      order.publicationStatus !==
        "pending"
    ) {

      return res
        .status(409)
        .json({
          error:
            "Инструкция уже рассмотрена."
        });

    }


    const now =
      new Date()
        .toISOString();


    const existing =
      findExistingInstruction(
        order.generatedInstruction
          .profession
      );


    const publishedInstruction =
      existing ||
      instructionsRepository.save({
        ...order.generatedInstruction,

        updatedAt:
          now
      });


    updatePublicGenerationOrder(
      order.id,
      {
        publicationStatus:
          "published",

        instructionId:
          publishedInstruction.id,

        publishedAt:
          now,

        reviewedAt:
          now,

        reviewedBy:
          String(
            req.user?.login ??
            "admin"
          ),

        rejectionReason:
          null
      }
    );


    console.log(
      "[PublicGeneration Admin] approved:",
      order.id,
      publishedInstruction.id
    );


    return res.json({
      ok:
        true,

      orderId:
        order.id,

      publicationStatus:
        "published",

      instructionId:
        publishedInstruction.id
    });

  }
);


publicGenerationRouter.post(
  "/admin/orders/:id/reject",

  requireAdmin,

  (req, res) => {

    const order =
      getPublicGenerationOrder(
        req.params.id
      );


    if (!order) {

      return res
        .status(404)
        .json({
          error:
            "Заказ не найден"
        });

    }


    if (
      order.status !==
        "generated" ||
      !order.generatedInstruction
    ) {

      return res
        .status(409)
        .json({
          error:
            "Инструкция ещё не готова."
        });

    }


    if (
      order.publicationStatus ===
        "rejected"
    ) {

      return res.json({
        ok:
          true,

        orderId:
          order.id,

        publicationStatus:
          "rejected"
      });

    }


    if (
      order.publicationStatus !==
        "pending"
    ) {

      return res
        .status(409)
        .json({
          error:
            "Инструкция уже опубликована."
        });

    }


    const now =
      new Date()
        .toISOString();


    const reason =
      String(
        req.body?.reason ??
        ""
      )
      .trim()
      .slice(
        0,
        500
      );


    updatePublicGenerationOrder(
      order.id,
      {
        publicationStatus:
          "rejected",

        reviewedAt:
          now,

        reviewedBy:
          String(
            req.user?.login ??
            "admin"
          ),

        rejectionReason:
          reason ||
          null
      }
    );


    console.log(
      "[PublicGeneration Admin] rejected:",
      order.id
    );


    return res.json({
      ok:
        true,

      orderId:
        order.id,

      publicationStatus:
        "rejected"
    });

  }
);
