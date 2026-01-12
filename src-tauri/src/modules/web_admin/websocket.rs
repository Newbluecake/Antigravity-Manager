use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    response::Response,
};
use futures::{sink::SinkExt, stream::StreamExt};
use serde::Deserialize;
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{error, info};

use crate::modules::web_admin::{auth, WebAdminError};

#[derive(Debug, Clone, serde::Serialize)]
pub struct WebSocketEvent {
    pub event_type: String,
    pub data: serde_json::Value,
}

#[derive(Clone)]
pub struct WebSocketState {
    pub broadcaster: Arc<broadcast::Sender<WebSocketEvent>>,
}

impl WebSocketState {
    pub fn new() -> Self {
        let (tx, _rx) = broadcast::channel(100);
        Self {
            broadcaster: Arc::new(tx),
        }
    }

    pub fn broadcast(&self, event: WebSocketEvent) {
        let _ = self.broadcaster.send(event);
    }
}

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    token: String,
}

/// WebSocket handler with JWT authentication
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WsQuery>,
    State(ws_state): State<WebSocketState>,
) -> Result<Response, WebAdminError> {
    // Verify JWT token
    let claims = auth::verify_token(&query.token)?;

    info!("WebSocket connection authenticated for user: {}", claims.sub);

    Ok(ws.on_upgrade(move |socket| handle_socket(socket, ws_state, claims.sub)))
}

async fn handle_socket(socket: WebSocket, ws_state: WebSocketState, user_id: String) {
    info!("WebSocket connection established for user: {}", user_id);

    let (mut sender, mut receiver) = socket.split();

    // Subscribe to broadcasts
    let mut rx = ws_state.broadcaster.subscribe();

    // Spawn a task to forward broadcast events to this client
    let mut send_task = tokio::spawn(async move {
        while let Ok(event) = rx.recv().await {
            match serde_json::to_string(&event) {
                Ok(json) => {
                    if sender.send(Message::Text(json)).await.is_err() {
                        break;
                    }
                }
                Err(e) => {
                    error!("Failed to serialize WebSocket event: {}", e);
                }
            }
        }
    });

    // Spawn a task to handle incoming messages (ping/pong, close, etc.)
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    info!("Received WebSocket message: {}", text);
                    // Handle client messages if needed
                }
                Message::Close(_) => {
                    info!("WebSocket close message received");
                    break;
                }
                Message::Ping(data) => {
                    // Axum handles pong automatically
                    info!("WebSocket ping received");
                }
                Message::Pong(_) => {
                    // Client pong response
                }
                _ => {}
            }
        }
    });

    // Wait for either task to finish
    tokio::select! {
        _ = (&mut send_task) => {
            recv_task.abort();
        },
        _ = (&mut recv_task) => {
            send_task.abort();
        },
    }

    info!("WebSocket connection closed for user: {}", user_id);
}
