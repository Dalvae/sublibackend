import {
  Data,
  Cart,
  AbstractPaymentProcessor,
  Payment,
  PaymentSessionStatus,
  PaymentSessionResponse,
  PaymentProcessorContext,
  PaymentProcessorSessionResponse,
} from "@medusajs/medusa";
import {
  WebpayPlus,
  Options,
  IntegrationApiKeys,
  Environment,
  IntegrationCommerceCodes,
} from "transbank-sdk";
import { EOL } from "os";
import { v4 as uuidv4 } from "uuid";
interface PaymentProcessorError {
  error: string;
  code?: string;
  detail?: any;
}

class WebPayPaymentProcessor extends AbstractPaymentProcessor {
  static identifier = "Webpay";
  webpayOptions: Options;

  constructor(container, options) {
    super(container);
    const commerceCode = process.env.WEBPAY_COMMERCE_CODE;
    const apiKey = process.env.WEBPAY_API_KEY;
    const environment =
      process.env.WEBPAY_ENVIRONMENT === "Production"
        ? Environment.Production
        : Environment.Integration;

    this.webpayOptions = new Options(commerceCode, apiKey, environment);
  }

  protected buildError(
    message: string,
    e: Error | PaymentProcessorError
  ): PaymentProcessorError {
    // Determinar si 'e' es un PaymentProcessorError o un Error estándar
    let isPPError = (error: any): error is PaymentProcessorError => {
      return "error" in error && "code" in error && "detail" in error;
    };

    let detail = isPPError(e)
      ? `${e.error}\n${e.detail ?? ""}`
      : e.message ?? "";
    let errorCode = isPPError(e) ? e.code : "";

    return {
      error: message,
      code: errorCode,
      detail: detail,
    };
  }

  async initiatePayment(
    context: PaymentProcessorContext
  ): Promise<PaymentProcessorSessionResponse> {
    // Configuración para la transacción con Transbank
    const tx = new WebpayPlus.Transaction(this.webpayOptions);

    try {
      const buyOrder = uuidv4().replace(/-/g, "").substring(0, 26);
      console.log("Generated Buy Orderxs:", buyOrder);
      const transbankResponse = await tx.create(
        buyOrder, // buyOrder: Identificador único de la compra
        context.resource_id, // sessionId: Supongo que es el nombre del comercio, aqui el codigo del carrito
        context.amount, // amount: Monto de la transacción
        `https://www.sublimahyca.cl/checkout`
      );

      const session_data = {
        transbankToken: transbankResponse.token,
        redirectUrl: transbankResponse.url,
        buyOrder: buyOrder,
        // Otros datos relevantes...
      };

      // No es necesario actualizar la metadata del cliente en este punto
      const update_requests = {};

      return {
        session_data,
        update_requests,
      };
    } catch (error) {
      console.error("Error al iniciar el pago con Transbank:", error);
      throw this.buildError("Error iniciando pago con Transbank", error);
    }
  }
  async retrievePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    // Verificar si el token de Transbank está presente
    const transbankToken = paymentSessionData.transbankToken as string;
    console.log("Payment Session Datssa:", paymentSessionData);

    // Comprueba si el token existe y es una cadena no vacía
    // if (!transbankTokenWs) {
    //   console.error(
    //     "Error: No Transbank token provided in payment session data RETRIEVEPAYMENT FUNC"
    //   );
    //   return {
    //     error:
    //       "No Transbank token provided in payment session data RETRIEVEPAYMENT FUNC",
    //   };
    // }

    try {
      const tx = new WebpayPlus.Transaction(this.webpayOptions);
      const response = await tx.status(transbankToken); // Asegúrate de que aquí también estés usando transbankTokenWs

      return response;
    } catch (error) {
      console.error("Error al recuperar el pago con Transbank:", error);
      throw this.buildError("Error recuperando pago con Transbank", error);
    }
  }

  async getPaymentStatus(
    sessionData: Record<string, unknown>
  ): Promise<PaymentSessionStatus> {
    console.log("Session Data del paymentstatus:", sessionData);
    console.log("Type of sessionData:", typeof sessionData);
    console.log("Keys in sessionData:", Object.keys(sessionData));
    const status = sessionData.status ? (sessionData.status as string) : null;
    // const transbankToken = sessionData.transbankToken as string;
    // if (!transbankToken) {
    //   throw { error: "No Transbank token provided in session dataxx" };
    // }

    try {
      // Mapeo de los estados de Transbank a los estados de Medusa
      switch (status) {
        case "AUTHORIZED":
          return PaymentSessionStatus.AUTHORIZED;
        case "FAILED":
          return PaymentSessionStatus.ERROR;
        case "CANCELED":
          return PaymentSessionStatus.CANCELED;
        default:
          return PaymentSessionStatus.PENDING;
      }
    } catch (error) {
      console.error(
        "Error al obtener el estado del pago con Transbank:",
        error
      );
      throw this.buildError("Error retrieving payment status", error);
    }
  }

  async updatePayment(
    context: PaymentProcessorContext
  ): Promise<void | PaymentProcessorError | PaymentProcessorSessionResponse> {
    // Simplemente devuelve los datos actuales de la sesión de pago
    // Aquí puedes agregar lógica adicional si es necesario, como verificar si el monto ha cambiado
    // y manejar ese caso de forma adecuada.
    return {
      session_data: context.paymentSessionData,
    };
  }

  async updatePaymentData(
    sessionId: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    // Devuelve los datos proporcionados tal como están.
    // Agrega aquí lógica adicional si necesitas interactuar con Transbank.
    return data;
  }

  async deletePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    return paymentSessionData;
  }

  async authorizePayment(
    paymentSessionData: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<
    | PaymentProcessorError
    | { status: PaymentSessionStatus; data: Record<string, unknown> }
  > {
    console.log("Iniciando proceso de autorización de pago");

    const transbankTokenWs = paymentSessionData.transbankTokenWs as string;

    console.log(`Token WS recibido: ${transbankTokenWs}`);

    if (!transbankTokenWs) {
      console.error("Token ws de Transbank no proporcionado");
      return {
        error: "Token ws de Transbank no proporcionado",
      };
    }

    try {
      const tx = new WebpayPlus.Transaction(this.webpayOptions);
      console.log("Cuerpo de la solicitud a Transbank:", transbankTokenWs);

      let response;
      try {
        response = await tx.commit(transbankTokenWs);
        console.log(`Respuesta recibida de Transbank:`, response);

        if (response.status === "AUTHORIZED" && response.response_code === 0) {
          return {
            status: PaymentSessionStatus.AUTHORIZED,
            data: { ...paymentSessionData, ...response },
          };
        } else {
          return {
            error: "Autorización fallida",
            code: response.response_code.toString(),
            detail: response,
          };
        }
      } catch (err) {
        console.error("Error durante tx.commit en Transbank:", err);
        if (err.response) {
          console.error(
            "Cuerpo de la respuesta de error de Transbank:",
            err.response.data
          );
        }
        throw this.buildError("Error authorizing payment with Transbank", err);
      }
    } catch (error) {
      console.error(
        "Error al intentar autorizar el pago con Transbank:",
        error
      );
      return this.buildError("Error authorizing payment with Transbank", error);
    }
  }

  async capturePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    const transbankToken = paymentSessionData.transbankToken as string;
    const authorizationCode = paymentSessionData.authorizationCode as string;
    const buyOrder = paymentSessionData.buyOrder as string;
    const captureAmount = paymentSessionData.amount as number;

    if (!transbankToken || !authorizationCode || !buyOrder) {
      console.log(
        "Datos faltantes para la captura del pago:",
        paymentSessionData
      );
      return { error: "Faltan datos necesarios para la captura del pago" };
    }

    try {
      console.log("Iniciando captura de pago:", {
        transbankToken,
        buyOrder,
        authorizationCode,
        captureAmount,
      });
      const tx = new WebpayPlus.Transaction(this.webpayOptions);
      const response = await tx.capture(
        transbankToken,
        buyOrder,
        authorizationCode,
        captureAmount
      );

      console.log("Respuesta de captura de pago:", response);
      return {
        authorization_code: response.authorization_code,
        authorization_date: response.authorization_date,
        captured_amount: response.captured_amount,
        response_code: response.response_code,
      };
    } catch (error) {
      console.error("Error al capturar el pago con Transbank:", error);
      return this.buildError("Error capturing payment with Transbank", error);
    }
  }

  async refundPayment(
    paymentSessionData: Record<string, unknown>,
    refundAmount: number
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    const transbankToken = paymentSessionData.transbankToken as string;

    if (!transbankToken) {
      return { error: "No Transbank token provided in session data" };
    }

    try {
      const tx = new WebpayPlus.Transaction(this.webpayOptions);
      const response = await tx.refund(transbankToken, refundAmount);

      return {
        authorization_code: response.authorization_code,
        authorization_date: response.authorization_date,
        nullified_amount: response.nullified_amount,
        response_code: response.response_code,
      };
    } catch (error) {
      console.error("Error al realizar el reembolso con Transbank:", error);
      return this.buildError("Error refunding payment with Transbank", error);
    }
  }

  async cancelPayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    const transbankToken = paymentSessionData.transbankToken as string;
    const amount = paymentSessionData.amount as number; // El monto total de la transacción

    if (!transbankToken) {
      return { error: "No Transbank token provided in session data" };
    }

    try {
      const tx = new WebpayPlus.Transaction(this.webpayOptions);

      // La lógica para determinar si se debe realizar una cancelación o una reversión
      // depende del tiempo transcurrido desde la confirmación de la transacción.
      // Puedes necesitar almacenar la hora de la confirmación en `paymentSessionData` para esta comprobación.

      const response = await tx.refund(transbankToken, amount);

      return {
        authorization_code: response.authorization_code,
        authorization_date: response.authorization_date,
        nullified_amount: response.nullified_amount,
        response_code: response.response_code,
        type: response.type, // 'REVERSAL' o 'CANCELLATION', dependiendo de la operación realizada
      };
    } catch (error) {
      console.error("Error al cancelar el pago con Transbank:", error);
      return this.buildError("Error cancelling payment with Transbank", error);
    }
  }
}

export default WebPayPaymentProcessor;
