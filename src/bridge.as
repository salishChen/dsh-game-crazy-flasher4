// Added to frame 6 without recompiling any of the original game actions.
function cf4Read()
{
   if(_root.money == undefined) { return null; }
   var names = ["allkilled","manhp","武器槽1","武器槽1_弹夹内子弹","武器槽1_子弹数","武器槽2","武器槽2_弹夹内子弹","武器槽2_子弹数","武器槽4","武器槽4_弹夹内子弹","武器槽4_子弹数","刀种","刀威力","nickname","主线任务解锁"];
   var stats = {};
   for(var i = 0; i < names.length; i++) { stats[names[i]] = _root[names[i]]; }
   _root.cf4Overflow = false;
   var world = {schemaVersion:1,frame:_root._currentframe,root:cf4Variables(_root),nodes:[]};
   if(typeof(_root.gameworld) == "movieclip") { cf4Capture(_root.gameworld,["gameworld"],world.nodes); }
   if(_root.cf4Overflow) { return {error:"当前场景超出保存上限，请稍后重试"}; }
   return {coins:_root.money,stats:stats,world:world};
}
function cf4Apply(state)
{
   if(state == null || state.stats == undefined || state.coins < 0) { return false; }
   var names = ["allkilled","manhp","武器槽1","武器槽1_弹夹内子弹","武器槽1_子弹数","武器槽2","武器槽2_弹夹内子弹","武器槽2_子弹数","武器槽4","武器槽4_弹夹内子弹","武器槽4_子弹数","刀种","刀威力","nickname","主线任务解锁"];
   for(var i = 0; i < names.length; i++) { _root[names[i]] = state.stats[names[i]]; }
   _root.money = state.coins;
   return true;
}
function cf4Restore(state)
{
   if(!cf4Apply(state)) { return false; }
   _root.cf4Pending = state;
   _root.gotoAndStop(state.world == undefined ? 64 : state.world.frame);
   return true;
}
function cf4Variables(clip)
{
   var values = {};
   for(var key in clip) {
      if(key.charAt(0) != "_" && key.indexOf("cf4") != 0 && key != "money" && key != "keepshooting" && key != "keepshooting2" && key != "waiting" && key != "myrace") {
         var value = clip[key];
         if(typeof(value) == "number" && isFinite(value) || typeof(value) == "boolean" || typeof(value) == "string" && value.length < 2048) { values[key] = value; }
      }
   }
   return values;
}
function cf4Capture(clip,path,nodes)
{
   if(nodes.length >= 1500) { _root.cf4Overflow = true; return; }
   var node = {path:path,depth:clip.getDepth(),frame:clip._currentframe,transform:[clip._x,clip._y,clip._xscale,clip._yscale,clip._rotation,clip._alpha,clip._visible],vars:cf4Variables(clip)};
   if(clip.__cf4Linkage != undefined) { node.linkage = clip.__cf4Linkage; }
   nodes.push(node);
   if(path.length < 12) {
      for(var key in clip) {
         if(typeof(clip[key]) == "movieclip" && clip[key]._parent == clip) {
            var child = path.concat([key]); cf4Capture(clip[key],child,nodes);
         }
      }
   }
}
function cf4Resolve(path)
{
   var clip = _root;
   for(var i = 0; i < path.length; i++) { clip = clip[path[i]]; }
   return clip;
}
function cf4RestorePrepare()
{
   if(_root.cf4Pending.world == undefined) { return true; }
   var nodes = _root.cf4Pending.world.nodes;
   for(var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var parent = cf4Resolve(node.path.slice(0,node.path.length - 1));
      var clip = cf4Resolve(node.path);
      if(typeof(clip) != "movieclip") {
         // Anonymous timeline clips receive new instance names after a reload.
         // Their authored depth remains stable; recover that identity first.
         for(var key in parent) {
            if(typeof(parent[key]) == "movieclip" && parent[key]._parent == parent && parent[key].getDepth() == node.depth) {
               clip = parent[key]; clip._name = node.path[node.path.length - 1]; break;
            }
         }
      }
      if(typeof(clip) != "movieclip" && node.linkage != undefined) {
         clip = parent.attachMovie(node.linkage,node.path[node.path.length - 1],node.depth);
      }
      if(typeof(clip) == "movieclip" && clip._currentframe != node.frame) { clip.gotoAndStop(node.frame); }
   }
   return true;
}
function cf4RestoreFinish()
{
   var state = _root.cf4Pending;
   if(state.world != undefined) {
      cf4RestorePrepare();
      var allowed = {};
      var nodes = state.world.nodes;
      for(var i = 0; i < nodes.length; i++) { allowed[nodes[i].path.join("/")] = true; }
      // Freshly loaded levels may contain enemies already removed in the saved scene.
      var actual = []; if(typeof(_root.gameworld) == "movieclip") { cf4Capture(_root.gameworld,["gameworld"],actual); }
      for(var i = actual.length - 1; i >= 0; i--) {
         var node = actual[i];
         if(!allowed[node.path.join("/")]) {
            var extra = cf4Resolve(node.path); extra.swapDepths(100000 + i); extra.removeMovieClip();
         }
      }
      for(var i = 0; i < nodes.length; i++) {
         var node = nodes[i]; var clip = cf4Resolve(node.path);
         if(typeof(clip) == "movieclip") {
            if(clip._currentframe != node.frame) { clip.gotoAndStop(node.frame); }
            for(var key in node.vars) { clip[key] = node.vars[key]; }
            clip._x = node.transform[0]; clip._y = node.transform[1]; clip._xscale = node.transform[2]; clip._yscale = node.transform[3]; clip._rotation = node.transform[4]; clip._alpha = node.transform[5]; clip._visible = node.transform[6];
         }
      }
      for(var key in state.world.root) { _root[key] = state.world.root[key]; }
   }
   cf4Apply(state);
   delete _root.cf4Pending;
   return true;
}
// Preserve linkage for weapons, ammunition and other dynamically attached clips.
if(MovieClip.prototype.__cf4Attach == undefined) {
   MovieClip.prototype.__cf4Attach = MovieClip.prototype.attachMovie;
   MovieClip.prototype.attachMovie = function(linkage,name,depth,init) {
      var clip = this.__cf4Attach(linkage,name,depth,init);
      clip.__cf4Linkage = linkage; return clip;
   };
}
_global.flash.external.ExternalInterface.addCallback("cf4Read",_root,cf4Read);
_global.flash.external.ExternalInterface.addCallback("cf4Apply",_root,cf4Apply);
_global.flash.external.ExternalInterface.addCallback("cf4Restore",_root,cf4Restore);
_global.flash.external.ExternalInterface.addCallback("cf4RestorePrepare",_root,cf4RestorePrepare);
_global.flash.external.ExternalInterface.addCallback("cf4RestoreFinish",_root,cf4RestoreFinish);
function cf4Status() { return {ready:_root._currentframe >= 14,started:_root.money != undefined,frame:_root._currentframe,coins:_root.money}; }
_global.flash.external.ExternalInterface.addCallback("cf4Status",_root,cf4Status);
function cf4Ready() { return _root._currentframe >= 14; }
_global.flash.external.ExternalInterface.addCallback("cf4Ready",_root,cf4Ready);
