package com.ggumtak.myamgi.ui

import android.view.KeyEvent

/**
 * Pure JVM-testable keyboard & Comet side-volume-key mapper for [StudyActivity].
 */
object StudyKeyHandler {

    enum class StudyAction {
        NONE,
        SHOW_ANSWER,
        RATE_AGAIN,
        RATE_HARD,
        RATE_GOOD,
        RATE_EASY,
        UNDO,
        HANJA_OPEN,
        HANJA_NEXT,
        HANJA_PREV
    }

    fun mapKey(
        keyCode: Int,
        isAnswerShown: Boolean,
        twoButtonMode: Boolean,
        volumeKeyStudy: Boolean,
        isShiftPressed: Boolean = false
    ): StudyAction {
        return when (keyCode) {
            KeyEvent.KEYCODE_SPACE,
            KeyEvent.KEYCODE_ENTER,
            KeyEvent.KEYCODE_NUMPAD_ENTER -> {
                if (!isAnswerShown) StudyAction.SHOW_ANSWER else StudyAction.RATE_GOOD
            }

            KeyEvent.KEYCODE_1,
            KeyEvent.KEYCODE_NUMPAD_1 -> {
                if (isAnswerShown) StudyAction.RATE_AGAIN else StudyAction.NONE
            }

            KeyEvent.KEYCODE_2,
            KeyEvent.KEYCODE_NUMPAD_2 -> {
                if (!isAnswerShown) {
                    StudyAction.NONE
                } else if (twoButtonMode) {
                    StudyAction.RATE_GOOD
                } else {
                    StudyAction.RATE_HARD
                }
            }

            KeyEvent.KEYCODE_3,
            KeyEvent.KEYCODE_NUMPAD_3 -> {
                if (!isAnswerShown || twoButtonMode) StudyAction.NONE else StudyAction.RATE_GOOD
            }

            KeyEvent.KEYCODE_4,
            KeyEvent.KEYCODE_NUMPAD_4 -> {
                if (!isAnswerShown || twoButtonMode) StudyAction.NONE else StudyAction.RATE_EASY
            }

            KeyEvent.KEYCODE_VOLUME_DOWN -> {
                if (!volumeKeyStudy) {
                    StudyAction.NONE
                } else if (!isAnswerShown) {
                    StudyAction.SHOW_ANSWER
                } else {
                    StudyAction.RATE_GOOD
                }
            }

            KeyEvent.KEYCODE_VOLUME_UP -> {
                if (!volumeKeyStudy) {
                    StudyAction.NONE
                } else if (!isAnswerShown) {
                    StudyAction.SHOW_ANSWER
                } else {
                    StudyAction.RATE_AGAIN
                }
            }

            KeyEvent.KEYCODE_Z,
            KeyEvent.KEYCODE_U -> StudyAction.UNDO

            KeyEvent.KEYCODE_Q -> StudyAction.HANJA_OPEN

            KeyEvent.KEYCODE_W -> if (isShiftPressed) StudyAction.HANJA_PREV else StudyAction.HANJA_NEXT

            else -> StudyAction.NONE
        }
    }
}
