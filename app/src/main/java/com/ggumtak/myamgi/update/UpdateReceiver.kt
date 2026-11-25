package com.ggumtak.myamgi.update

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import android.widget.Toast

/**
 * Receives [PackageInstaller] session commit results for [AppUpdater].
 */
class UpdateReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                val confirm: Intent? = if (Build.VERSION.SDK_INT >= 33) {
                    intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra(Intent.EXTRA_INTENT)
                }
                confirm?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)?.let {
                    runCatching { context.startActivity(it) }
                }
            }
            PackageInstaller.STATUS_SUCCESS -> {
                AppUpdater.forgetDownloads(context)
                Toast.makeText(context.applicationContext, "앱 업데이트가 완료되었습니다.", Toast.LENGTH_SHORT).show()
            }
            PackageInstaller.STATUS_FAILURE_ABORTED -> Unit
            else -> {
                AppUpdater.forgetDownloads(context)
                val msg = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
                val toastText = if (msg.isNullOrBlank()) {
                    "업데이트 설치에 실패했습니다."
                } else {
                    "업데이트 설치에 실패했습니다: $msg"
                }
                Toast.makeText(context.applicationContext, toastText, Toast.LENGTH_LONG).show()
            }
        }
    }
}
