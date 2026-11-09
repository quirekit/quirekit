# @quirekit/extension-whiteboard

## 0.0.2

### Patch Changes

- Undo and redo of a whiteboard or mind map save now advance its revision instead of restoring the older one, so every write of the object moves its revision forward and collaboration can tell a stale concurrent save from a local undo. Pasting a whiteboard gives the copy a new identity, as mind maps already did.

  撤销、重做白板或思维导图的保存时，版本号继续递增而不是退回旧值，每次写入都推进版本，协同可以区分并发的过期保存与本地撤销。粘贴白板时副本获得新的身份，与思维导图一致。
