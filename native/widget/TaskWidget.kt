package com.sade.calendar.widget

import android.appwidget.AppWidgetProvider
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent

class TaskWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { ids.forEach { WidgetUpdater.update(context, it) } }
  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: android.os.Bundle) { WidgetUpdater.update(context, id) }
  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action in listOf(Intent.ACTION_DATE_CHANGED, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED, Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_CONFIGURATION_CHANGED)) WidgetUpdater.updateAll(context)
  }
  override fun onDeleted(context: Context, ids: IntArray) {
    val edit = WidgetDataRepository.preferences(context).edit()
    ids.forEach { edit.remove("days_$it") }; edit.apply()
  }
}
