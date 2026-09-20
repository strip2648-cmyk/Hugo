# Реално достапно

Провери: `npm run capabilities` и `npm run tools:audit`.

**Реално локално:** меморија и пребарување, планирање/преиспитување/рефлектирање, безклучни алатки, CRM, кампањи, распоред, потсетници, извештаи, тестови.

**Реално преку твојот браузер:** отварање/читање/пребарување, клик, пишување, пополнување форми, слика од екран, говор и слушање.

**Заштитено:** објавување на социјални мрежи (изрична потврда за да не ти банираат профилите) и `git push`.

**Не е вклучено:** клоуд AI и платени API; невронски embeddings; мобилна апликација; cloud deployment.


## v7 додатоци
**Фајлови:** file_write, file_read, file_edit, file_append, file_list, file_tree, file_search, file_mkdir, file_copy, file_move, file_delete (корпа/трајно со потврда), file_stat, file_hash, path_resolve.

**Компјутер:** host_report, ps_run, cmd_run, shell_run, wsl_list, wsl_info, wsl_run, wsl_read, wsl_write, process_list, process_kill, app_open, app_start, window_list, window_focus, clip_get, clip_set, screen_shot, volume_control, media_key, say, notify.

**Facebook / YouTube:** fb_open, fb_feed_read, fb_write_post, fb_publish (со потврда), fb_search, yt_open, yt_search, yt_play, yt_pause, yt_resume, yt_next, yt_volume, yt_now_playing.

**Вид и потврди:** vision_page, vision_ask, vision_screen, confirm_pending, confirm_approve, confirm_deny, confirm_request.

**Безбедност:** без зачувани лозинки/cookies; деструктивни команди блокирани без confirm: true; files.deny штити Chrome профил, .ssh и системски фајлови.
