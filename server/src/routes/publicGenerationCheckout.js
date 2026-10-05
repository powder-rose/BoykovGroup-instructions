import {
  Router
} from "express";

import {
  updatePublicGenerationOrder
} from "../services/publicGenerationOrderService.js";


export const publicGenerationCheckoutRouter =
  Router();


const OFFER_URL =
  "https://boykovdocs.ru/offer/";

const PERSONAL_DATA_URL =
  "https://boykovdocs.ru/personal-data-consent/";


/*
 * ============================================================
 * PAYMENT CONSENTS
 * ============================================================
 *
 * Этот route является middleware перед существующим
 * POST /api/public-generation/orders.
 *
 * Сам существующий order route не меняем.
 */
publicGenerationCheckoutRouter.post(
  "/orders",

  (
    req,
    res,
    next
  ) => {

    const offerAccepted =
      req.body?.offerAccepted ===
      true;

    const personalDataConsentAccepted =
      req.body
        ?.personalDataConsentAccepted ===
      true;


    /*
     * Без двух обязательных согласий
     * платёжный заказ вообще не создаётся.
     */
    if (
      !offerAccepted ||
      !personalDataConsentAccepted
    ) {

      return res
        .status(422)
        .json({
          code:
            "PAYMENT_CONSENTS_REQUIRED",

          error:
            "Для оплаты необходимо принять публичную оферту и дать согласие на обработку персональных данных."
        });

    }


    /*
     * Сохраняем факт согласия непосредственно
     * в созданный заказ.
     *
     * Существующий route после создания заказа
     * вызывает res.json(). Здесь перехватываем
     * только успешный ответ 201.
     */
    const originalJson =
      res.json.bind(
        res
      );


    res.json =
      function(
        payload
      ) {

        if (
          res.statusCode ===
            201 &&
          payload?.orderId
        ) {

          const acceptedAt =
            new Date()
              .toISOString();


          const updated =
            updatePublicGenerationOrder(
              payload.orderId,
              {
                checkoutConsent: {

                  offerAccepted:
                    true,

                  personalDataConsentAccepted:
                    true,

                  acceptedAt,

                  offerUrl:
                    OFFER_URL,

                  personalDataConsentUrl:
                    PERSONAL_DATA_URL,

                  ip:
                    String(
                      req.ip ??
                      ""
                    )
                    .slice(
                      0,
                      120
                    ),

                  forwardedFor:
                    String(
                      req.get(
                        "x-forwarded-for"
                      ) ??
                      ""
                    )
                    .slice(
                      0,
                      500
                    ),

                  userAgent:
                    String(
                      req.get(
                        "user-agent"
                      ) ??
                      ""
                    )
                    .slice(
                      0,
                      1000
                    )
                }
              }
            );


          /*
           * Если факт согласия записать не удалось,
           * не отдаём клиенту данные для CloudPayments.
           */
          if (!updated) {

            res.status(
              500
            );


            return originalJson({
              error:
                "Не удалось зафиксировать согласия перед оплатой."
            });

          }


        }


        return originalJson(
          payload
        );

      };


    return next();

  }
);
