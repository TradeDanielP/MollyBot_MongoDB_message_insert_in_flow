const express = require("express");
const { insertMessage, deleteMessage, deleteMessagesByFlowId, updateMessage } = require("../controllers/messageController");
const MessageSchema = require("../models/messageModel")

const router = express.Router();

/* Insertar un Mensaje*/
router.post("/", async (req, res) => {
  const { flowId, identifier, content } = req.body;
  try {
    const newMessage = await insertMessage(flowId, identifier, content); // Guardar el mensaje insertado
    res.status(201).json({
      message: 'Mensaje insertado correctamente.',
      data: newMessage // Responder con el contenido del mensaje insertado
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al insertar mensaje.', error });
  }
});

/* Obtener todos los mensajes */
router.get("/", async (req, res) => {
  try {
    const data = await MessageSchema.find(); // Recuperamos todos los mensajes
    res.json(data); // Enviamos los datos como respuesta en formato JSON
  } catch (error) {
    res.status(500).json({ message: error.message }); // Manejo de errores
  }
});

/* Eliminar un Mensaje */
router.delete("/:flowId/:identifierToDelete", async (req, res) => {
  const { flowId, identifierToDelete } = req.params;

  try {
    const deletedMessage = await deleteMessage(flowId, identifierToDelete);
    res.status(200).json({ message: 'Mensaje eliminado correctamente.', deletedMessage });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar mensaje.', error: error.message });
  }
});

/* Eliminar todos los Mensajes por flowId */
router.delete("/:flowId", async (req, res) => {
  const { flowId } = req.params;

  try {
    const result = await deleteMessagesByFlowId(flowId);
    if (result.deletedCount > 0) {
      res.status(200).json({ message: `Se eliminaron ${result.deletedCount} mensajes con flowId ${flowId}` });
    } else {
      res.status(404).json({ message: `No se encontraron mensajes con flowId ${flowId}` });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar mensajes.', error: error.message });
  }
});



router.put("/messages/:flowId/:oldIdentifier", async (req, res) => {
  const { flowId, oldIdentifier } = req.params;
  const updatedData = req.body; // Aquí recibimos los datos actualizados, incluyendo posiblemente el nuevo identificador

  try {
    await updateMessage(flowId, oldIdentifier, updatedData);
    res.status(200).send('Mensaje actualizado correctamente.');
  } catch (error) {
    res.status(500).send('Error al actualizar mensaje.');
  }
});


module.exports = router;