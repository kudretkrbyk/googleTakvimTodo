package com.sade.calendar.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews
import com.sade.calendar.R

object WidgetUpdater {
  fun updateAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    manager.getAppWidgetIds(ComponentName(context, TaskWidget::class.java)).forEach { update(context, it) }
  }
  fun update(context: Context, id: Int) {
    val manager = AppWidgetManager.getInstance(context)
    val options = manager.getAppWidgetOptions(id)
    val height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 200)
    val fontScale = context.resources.configuration.fontScale.coerceAtLeast(1f)
    val count = ((height - 56) / (42 * fontScale).toInt()).coerceIn(1, 10)
    val views = RemoteViews(context.packageName, R.layout.task_widget)
    views.setOnClickPendingIntent(R.id.quick_add, WidgetActions.quickAdd(context))
    views.removeAllViews(R.id.widget_rows)
    val rows = WidgetDataRepository.rows(context, id).take(count)
    if (rows.isEmpty()) {
      val row = RemoteViews(context.packageName, R.layout.task_widget_row)
      row.setTextViewText(R.id.row_meta, "Yaklaşan görev yok")
      row.setTextViewText(R.id.row_title, "Yeni bir görev ekle")
      views.addView(R.id.widget_rows, row)
    } else rows.forEach { item ->
      val row = RemoteViews(context.packageName, R.layout.task_widget_row)
      row.setTextViewText(R.id.row_meta, "${item.group} · ${item.time}")
      row.setTextViewText(R.id.row_title, item.title)
      row.setOnClickPendingIntent(R.id.row_title, WidgetActions.quickAdd(context))
      views.addView(R.id.widget_rows, row)
    }
    manager.updateAppWidget(id, views)
  }
}
