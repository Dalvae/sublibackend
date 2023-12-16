// En /api/webpay/confirm-transaction.ts

import type { MedusaRequest, MedusaResponse } from "@medusajs/medusa";
import { WebpayPlus } from "transbank-sdk";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const tokenWs = req.query.token_ws;
  const resourceId = req.params.resource_id; // Asumiendo que tienes un ID de recurso o carrito

  // Verifica si el token_ws está presente
  if (!tokenWs) {
    // Si no hay token, redirige de vuelta al carrito
    return res.redirect(
      `https://www.sublimahyca.cl/order/confirmed/${resourceId}`
    );
  }

  try {
    // Aquí asumimos que la confirmación de la transacción ya se ha realizado
    // en tu servicio de pago de Transbank y solo necesitas manejar la redirección

    // Si la transacción fue exitosa, redirige al checkout
    res.redirect(`/checkout/${resourceId}`);
  } catch (error) {
    console.error("Error al procesar la transacción de Webpay:", error);
    // En caso de error, redirige de vuelta al carrito
    res.redirect(`/cart/${resourceId}`);
  }
}
