package com.ggumtak.myamgi.sync

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import com.ggumtak.myamgi.R
import com.ggumtak.myamgi.ui.MainActivity

/**
 * Lightweight Android foreground service that keeps the loopback host server and AnkiWeb sync
 * alive at full speed when the user switches to another app or turns off the screen.
 */
class SyncForegroundService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelfCleanly()
            return START_NOT_STICKY
        }

        val statusText = intent?.getStringExtra(EXTRA_STATUS)
            ?: "AnkiWeb과 카드·학습 기록을 맞추는 중…"

        ensureChannel()
        val notification = buildNotification(statusText)

        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        }.onSuccess {
            acquireLocks()
        }.onFailure {
            releaseLocks()
            stopSelf()
        }

        return START_NOT_STICKY
    }

    override fun onTimeout(startId: Int, fgsType: Int) {
        stopSelfCleanly()
    }

    override fun onDestroy() {
        releaseLocks()
        super.onDestroy()
    }

    private fun acquireLocks() {
        runCatching {
            val pm = getSystemService(PowerManager::class.java)
            if (pm != null) {
                val wl = wakeLock ?: pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG).apply {
                    setReferenceCounted(false)
                    wakeLock = this
                }
                wl.acquire(WAKE_LOCK_TIMEOUT_MS)
            }
        }
        runCatching {
            val wm = applicationContext.getSystemService(WifiManager::class.java)
            if (wm != null) {
                val lock = wifiLock ?: run {
                    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        WifiManager.WIFI_MODE_FULL_LOW_LATENCY
                    } else {
                        @Suppress("DEPRECATION")
                        WifiManager.WIFI_MODE_FULL_HIGH_PERF
                    }
                    wm.createWifiLock(mode, WIFI_LOCK_TAG).apply {
                        setReferenceCounted(false)
                        wifiLock = this
                    }
                }
                if (!lock.isHeld) {
                    lock.acquire()
                }
            }
        }
    }

    private fun releaseLocks() {
        runCatching {
            wakeLock?.let { if (it.isHeld) it.release() }
        }
        wakeLock = null
        runCatching {
            wifiLock?.let { if (it.isHeld) it.release() }
        }
        wifiLock = null
    }

    private fun stopSelfCleanly() {
        releaseLocks()
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
        }
        stopSelf()
    }

    private fun ensureChannel() {
        val mgr = getSystemService(NotificationManager::class.java) ?: return
        if (mgr.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "AnkiWeb 동기화",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "백그라운드에서 AnkiWeb 동기화를 진행하는 동안 상태를 표시합니다."
            setShowBadge(false)
        }
        mgr.createNotificationChannel(channel)
    }

    private fun buildNotification(statusText: String): Notification {
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val piFlags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val contentPi = PendingIntent.getActivity(this, 0, launchIntent, piFlags)

        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("myAmgi 동기화 중")
            .setContentText(statusText)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setProgress(0, 0, true)
            .setContentIntent(contentPi)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "myamgi_sync_channel"
        private const val NOTIFICATION_ID = 4102
        private const val ACTION_START = "com.ggumtak.myamgi.sync.START"
        private const val ACTION_STOP = "com.ggumtak.myamgi.sync.STOP"
        private const val EXTRA_STATUS = "status"
        private const val WAKE_LOCK_TAG = "myAmgi:SyncWakeLock"
        private const val WIFI_LOCK_TAG = "myAmgi:SyncWifiLock"
        private const val WAKE_LOCK_TIMEOUT_MS = 60L * 60L * 1000L

        fun update(context: Context, running: Boolean, statusText: String?) {
            val appCtx = context.applicationContext
            if (running) {
                val intent = Intent(appCtx, SyncForegroundService::class.java).apply {
                    action = ACTION_START
                    if (!statusText.isNullOrBlank()) putExtra(EXTRA_STATUS, statusText)
                }
                runCatching {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        appCtx.startForegroundService(intent)
                    } else {
                        appCtx.startService(intent)
                    }
                }
            } else {
                runCatching {
                    appCtx.stopService(Intent(appCtx, SyncForegroundService::class.java))
                }
            }
        }
    }
}
