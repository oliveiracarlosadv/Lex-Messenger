package br.com.lextecnologias.messenger;

import android.service.notification.NotificationListenerService;

/**
 * Só existe para o Android permitir que o Lex veja qual música está tocando (sessões de mídia).
 * O Lex não lê o conteúdo das notificações de outros apps.
 */
public class LexMusicListener extends NotificationListenerService {}
