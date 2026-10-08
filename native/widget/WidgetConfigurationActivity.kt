package com.sade.calendar.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.os.Bundle
import android.content.Intent
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Button
import android.widget.RadioGroup
import android.widget.RadioButton

class WidgetConfigurationActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setResult(RESULT_CANCELED)
    val id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
    if (id == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return }
    val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(32,48,32,32) }
    layout.addView(TextView(this).apply { text = "Widget görünümü"; textSize = 24f })
    val group = RadioGroup(this)
    listOf(7,30).forEach { days -> group.addView(RadioButton(this).apply { this.id = days; text = "$days gün"; minHeight = 64 }) }
    group.check(WidgetDataRepository.preferences(this).getInt("days_$id",7))
    layout.addView(group)
    layout.addView(Button(this).apply { text = "Kaydet"; setOnClickListener {
      WidgetDataRepository.preferences(this@WidgetConfigurationActivity).edit().putInt("days_$id",group.checkedRadioButtonId).apply()
      WidgetUpdater.update(this@WidgetConfigurationActivity,id)
      setResult(RESULT_OK,Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,id)); finish()
    } })
    setContentView(layout)
  }
}
