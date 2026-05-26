type MessageHandler = (data: unknown) => void

type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting"

class WSManager {
  private socket: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private retries = 0
  private readonly maxRetries = 8
  private readonly baseDelayMs = 500
  private readonly maxDelayMs = 10000
  private url = ""
  private handler: MessageHandler | null = null
  private shouldReconnect = false
  private connectionToken = 0
  state: ConnectionState = "idle"

  connect(url: string, onMessage: MessageHandler) {
    const sameActiveSocket =
      this.url === url &&
      this.socket !== null &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)

    this.url = url
    this.handler = onMessage
    this.shouldReconnect = true

    if (sameActiveSocket) {
      this.state = this.socket?.readyState === WebSocket.OPEN ? "connected" : "connecting"
      return
    }

    this.resetReconnectTimer()
    this.closeSocket()
    this.retries = 0
    this.open()
  }

  disconnect() {
    this.shouldReconnect = false
    this.handler = null
    this.retries = 0
    this.resetReconnectTimer()
    this.closeSocket()
    this.state = "idle"
  }

  private open() {
    if (!this.url || !this.shouldReconnect) {
      return
    }

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return
    }

    const socket = new WebSocket(this.url)
    const token = ++this.connectionToken
    this.socket = socket
    this.state = this.retries > 0 ? "reconnecting" : "connecting"

    socket.onopen = () => {
      if (!this.isActive(socket, token)) {
        return
      }
      this.state = "connected"
      this.retries = 0
    }

    socket.onmessage = (event) => {
      if (!this.isActive(socket, token) || !this.handler) {
        return
      }

      if (!this.handler) {
        return
      }
      try {
        const parsed = JSON.parse(event.data)
        this.handler(parsed)
      } catch {
        this.handler(event.data)
      }
    }

    socket.onclose = () => {
      if (!this.isActive(socket, token)) {
        return
      }

      this.socket = null

      if (!this.shouldReconnect) {
        this.state = "idle"
        return
      }

      this.scheduleReconnect()
    }

    socket.onerror = () => {
      if (this.isActive(socket, token) && socket.readyState === WebSocket.OPEN) {
        socket.close()
      }
    }
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect || !this.url) {
      this.state = "idle"
      return
    }

    if (this.retries >= this.maxRetries) {
      this.state = "idle"
      return
    }

    this.retries += 1
    this.state = "reconnecting"

    const delay = Math.min(this.baseDelayMs * 2 ** (this.retries - 1), this.maxDelayMs)
    this.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect) {
        this.open()
      }
    }, delay)
  }

  private resetReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private closeSocket() {
    const socket = this.socket
    if (!socket) {
      return
    }

    this.socket = null

    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close(1000, "disconnect")
    }
  }

  private isActive(socket: WebSocket, token: number) {
    return this.socket === socket && this.connectionToken === token
  }
}

export const wsManager = new WSManager()
