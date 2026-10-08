package com.sade.calendar.widget

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri

object WidgetActions {
  fun quickAdd(context: Context): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("sade://quick-add"))
      .setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
}
