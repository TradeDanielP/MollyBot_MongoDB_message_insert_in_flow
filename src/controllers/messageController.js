const Message = require("../models/messageModel");

/* Insertar un Mensaje */
async function insertMessage(flowId, newIdentifier, content) {
  // 1. Dividimos el identificador en niveles (partes)
  const newIdentifierArray = newIdentifier.split('.');

   // Validamos que no esté intentando insertar en un flujo principal (1.x)
   if (newIdentifierArray.length <= 2) {
    return { success: false, message: "No se puede insertar en el flujo principal. Use el endpoint de flujos principales." };
  }

  const newPrefix = newIdentifierArray.slice(0, -1).join('.'); // Prefijo: guarda el array menos la última posición

  // 2. Construimos una expresión regular que capture los mensajes en el mismo subnivel y subniveles
  const regexPattern = newPrefix ? `^${newPrefix}\\.(\\d+)(\\..*)?$` : `^(\\d+)(\\..*)?$`;

  // 3. Actualizamos todos los mensajes cuyo identificador está en el mismo subnivel y tiene un sufijo mayor o igual
  await Message.updateMany(
    {
      flowId: flowId,
      identifier: { $regex: regexPattern }, // Filtra mensajes en el mismo nivel
      $expr: {
        $gte: [
          { $toInt: { $arrayElemAt: [{ $split: ["$identifier", "."] }, newIdentifierArray.length - 1] } },
          { $toInt: newIdentifierArray[newIdentifierArray.length - 1] }
        ]
      }
    },
    [{
      $set: {
        identifier: {
          $concat: [
            // 4. Tomamos el prefijo que no cambia
            { $reduce: {
              input: { $slice: [{ $split: ["$identifier", "."] }, 0, newIdentifierArray.length - 1] },
              initialValue: "",
              in: {
                $concat: [
                  "$$value",
                  { $cond: [{ $eq: ["$$value", ""] }, "", "."] },
                  "$$this"
                ]
              }
            }},
            // 5. Incrementamos la última parte del identificador
            ".",
            { $toString: { 
              $add: [
                { $toInt: { $arrayElemAt: [{ $split: ["$identifier", "."] }, newIdentifierArray.length - 1] } },
                1
              ]
            }},
            // 6. Mantenemos los subniveles si los hay (por ejemplo, .1, .2, etc.)
            {
              $cond: [
                { $gt: [{ $size: { $split: ["$identifier", "."] } }, newIdentifierArray.length] }, // Si hay subniveles
                { 
                  $substrCP: [
                    "$identifier", 
                    { $strLenCP: { 
                      $concat: [
                        newPrefix,
                        ".",
                        { $toString: { $arrayElemAt: [{ $split: ["$identifier", "."] }, newIdentifierArray.length - 1] } }
                      ]
                    }}, 
                    { $subtract: [{ $strLenCP: "$identifier" }, { $strLenCP: newPrefix }] } // Ajustar la longitud correcta
                  ]
                }, // Adjuntamos los subniveles
                ""
              ]
            }
          ]
        }
      }
    }]
  );

  // 4. Insertamos el nuevo mensaje con el identificador dado
  const newMessage = new Message({
    flowId: flowId,
    identifier: newIdentifier,
    content: content
  });

  await newMessage.save();
  return newMessage;
}

/* Insertar un flujo principal */
async function insertMainFlow(newFlowId, content) {
  // 1. Verificamos si ya existe el flowId principal (1.x) que se está intentando insertar
  const lastMessage = await Message.findOne({ flowId: newFlowId }).sort({ identifier: -1 }).exec();

  if (lastMessage) {
    return { success: false, message: `El flujo principal 1.${newFlowId} ya existe.` };
  }

  // 2. Construimos el nuevo identifier para el flujo principal (1.x)
  const newIdentifier = `1.${newFlowId}`;

  // 3. Actualizamos todos los flujos principales existentes cuyo identifier sea mayor o igual al nuevo (1.x)
  await Message.updateMany(
    {
      identifier: { $regex: /^1\.(\d+)$/ }, // Filtra solo flujos principales (1.x)
      $expr: {
        $gte: [
          { $toInt: { $arrayElemAt: [{ $split: ["$identifier", "."] }, 1] } },
          newFlowId
        ]
      }
    },
    [{
      $set: {
        flowId: {
          $toString: {
            $add: [{ $toInt: "$flowId" }, 1] // Incrementa el flowId en 1
          }
        },
        identifier: {
          $concat: [
            "1.",
            { $toString: {
              $add: [
                { $toInt: { $arrayElemAt: [{ $split: ["$identifier", "."] }, 1] } },
                1 // Incrementa el segundo nivel (1.x) en 1
              ]
            }}
          ]
        }
      }
    }]
  );

  // 4. Insertamos el nuevo flujo principal con el flowId y el identifier generado
  const newFlow = new Message({
    flowId: newFlowId,
    identifier: newIdentifier,
    content: content
  });

  await newFlow.save();
  return { success: true, message: `El flujo principal 1.${newFlowId} ha sido creado exitosamente.` };
}

/* Eliminar un Mensaje */
async function deleteMessage(flowId, identifierToDelete) {
  // 1. Dividimos el identificador en niveles (partes)
  const identifierArray = identifierToDelete.split('.');
  const prefix = identifierArray.slice(0, -1).join('.'); // Prefijo del identificador a eliminar

  // 2. Construimos una expresión regular que capture los mensajes en el mismo subnivel y subniveles
  const regexPattern = prefix ? `^${prefix}\\.(\\d+)(\\..*)?$` : `^(\\d+)(\\..*)?$`;

  // 3. Eliminamos el mensaje con el identificador específico
  await Message.deleteOne({
    flowId: flowId,
    identifier: identifierToDelete
  });

  // 4. Actualizamos los mensajes cuyo identificador es mayor al que hemos eliminado
  await Message.updateMany(
    {
      flowId: flowId,
      identifier: { $regex: regexPattern }, // Filtra los mensajes en el mismo subnivel
      $expr: {
        $gt: [
          { $toInt: { $arrayElemAt: [{ $split: ["$identifier", "."] }, identifierArray.length - 1] } },
          { $toInt: identifierArray[identifierArray.length - 1] }
        ]
      }
    },
    [{
      $set: {
        identifier: {
          $concat: [
            // 5. Tomamos el prefijo que no cambia
            { $reduce: {
              input: { $slice: [{ $split: ["$identifier", "."] }, 0, identifierArray.length - 1] },
              initialValue: "",
              in: {
                $concat: [
                  "$$value",
                  { $cond: [{ $eq: ["$$value", ""] }, "", "."] },
                  "$$this"
                ]
              }
            }},
            // 6. Reducimos la última parte del identificador
            ".",
            { $toString: { 
              $subtract: [
                { $toInt: { $arrayElemAt: [{ $split: ["$identifier", "."] }, identifierArray.length - 1] } },
                1
              ]
            }},
            // 7. Mantenemos los subniveles si los hay (por ejemplo, .1, .2, etc.)
            {
              $cond: [
                { $gt: [{ $size: { $split: ["$identifier", "."] } }, identifierArray.length] }, // Si hay subniveles
                { 
                  $substrCP: [
                    "$identifier", 
                    { $strLenCP: { 
                      $concat: [
                        prefix,
                        ".",
                        { $toString: { $arrayElemAt: [{ $split: ["$identifier", "."] }, identifierArray.length - 1] } }
                      ]
                    }}, 
                    { $subtract: [{ $strLenCP: "$identifier" }, { $strLenCP: prefix }] } // Ajustar la longitud correcta
                  ]
                }, // Adjuntamos los subniveles
                ""
              ]
            }
          ]
        }
      }
    }]
  );
  
  return `Message ${identifierToDelete} deleted and identifiers updated`;
}

/* Eliminar todos los Mensajes por flowId */
const deleteMessagesByFlowId = async (flowId) => {
  return await Message.deleteMany({ flowId: flowId });
};

/* Intercambiar posiciones de dos flujos */
async function exchangeFlows(flowIdA, flowIdB) {
  // Paso 1: Validar que ambos flowId existan en la base de datos
  const flowAExists = await Message.findOne({ flowId: flowIdA });
  const flowBExists = await Message.findOne({ flowId: flowIdB });

  if (!flowAExists || !flowBExists) {
    return { success: false, message: "Uno o ambos flowIds no existen." };
  }

  // Paso 2: Actualizar flowIdA a un valor temporal (99)
  await Message.updateMany(
    { flowId: flowIdA },
    [
      {
        $set: {
          flowId: "99", // Flow temporal
          identifier: {
            $concat: [
              "1.", // Mantener siempre 1
              { $arrayElemAt: [{ $split: ["$identifier", "."] }, 1] }, // Obtener el segundo elemento (2)
              {
                $substrCP: [
                  "$identifier", 
                  { $add: [{ $strLenCP: "1." }, 1] }, // Cortar desde después del segundo número
                  { $subtract: [{ $strLenCP: "$identifier" }, { $add: [{ $strLenCP: "1."}, 1] }] } // Longitud restante
                ]
              }
            ]
          }
        }
      }
    ]
  );

  // Paso 3: Actualizar flowIdB a flowIdA
  await Message.updateMany(
    { flowId: flowIdB },
    [
      {
        $set: {
          flowId: flowIdA,
          identifier: {
            $concat: [
              "1.", // Mantener siempre 1
              flowIdA.toString(), // Cambiar a flowIdA como segundo nivel
              {
                $substrCP: [
                  "$identifier",
                  { $add: [{ $strLenCP: "1." }, 1] }, // Cortar desde después del segundo número
                  { $subtract: [{ $strLenCP: "$identifier" }, { $add: [{ $strLenCP: "1."}, 1] }] }
                ]
              }
            ]
          }
        }
      }
    ]
  );

  // Paso 4: Actualizar el flowId temporal (99) a flowIdB
  await Message.updateMany(
    { flowId: "99" },
    [
      {
        $set: {
          flowId: flowIdB,
          identifier: {
            $concat: [
              "1.", // Mantener siempre 1
              flowIdB.toString(), // Cambiar a flowIdB como segundo nivel
              {
                $substrCP: [
                  "$identifier",
                  { $add: [{ $strLenCP: "1." }, 1] }, // Cortar desde después del segundo número
                  { $subtract: [{ $strLenCP: "$identifier" }, { $add: [{ $strLenCP: "1."}, 1] }] }
                ]
              }
            ]
          }
        }
      }
    ]
  );

  return { success: true, message: `Los flujos ${flowIdA} y ${flowIdB} fueron intercambiados correctamente.` };
}

/* Actualizar un Mensaje */
async function updateMessage(flowId, oldIdentifier, updatedData) {
    const { identifier: newIdentifier, content } = updatedData;
  
    // Si el identificador ha cambiado
    if (oldIdentifier !== newIdentifier) {
      const oldPrefixArray = oldIdentifier.split('.');
      const newPrefixArray = newIdentifier.split('.');
  
      const oldPrefix = oldPrefixArray.slice(0, -1).join('.');
      const newPrefix = newPrefixArray.slice(0, -1).join('.');
  
      // Si los prefijos no coinciden, es un cambio de flujo
      if (oldPrefix !== newPrefix) {
        throw new Error('Los mensajes solo pueden ser actualizados dentro del mismo flujo.');
      }
  
      // Actualizamos el mensaje en cuestión con el nuevo identificador y datos adicionales
      await Message.updateOne(
        { flowId: flowId, identifier: oldIdentifier },
        { $set: { identifier: newIdentifier, content: content } } // Aquí actualizamos tanto el identificador como los demás datos
      );
  
      // Actualizamos los mensajes subsecuentes en el mismo subnivel si es necesario
      await Message.updateMany(
        { 
          flowId: flowId,
          identifier: { $regex: `^${oldPrefix}\\.\\d+$` },
          identifier: { $gte: oldIdentifier }
        },
        [{
          $set: {
            identifier: {
              $concat: [
                { $arrayElemAt: [{ $split: ["$identifier", "."] }, 0] },
                ".",
                { $toString: { $add: [{ $toInt: { $arrayElemAt: [{ $split: ["$identifier", "."] }, -1] } }, 1] } }
              ]
            }
          }
        }]
      );
    } else {
      // Si el identificador no ha cambiado, solo actualizamos los demás datos del mensaje
      await Message.updateOne(
        { flowId: flowId, identifier: oldIdentifier },
        { $set: { content: content } } // Aquí solo actualizamos el contenido u otros datos
      );
    }
  }
  

module.exports = {
  insertMessage,
  insertMainFlow,
  deleteMessage,
  deleteMessagesByFlowId,
  exchangeFlows,
  updateMessage
};
