// Global variable that defines the duration of the transition
var kTransitionDuration;

// Standard scalar smoothstep function
function Smoothstep( t )
{
	return 3*t*t - 2*t*t*t;
}

//
// Begin and update methods for basic timed transitions.
//
// These are written to match the framework from the presentation
// as closely as possible.  They will be invoked on "this", which
// is a plain javascreipt object in which the current position is
// stored in the attribute "cur".
//
// The duration of the transition is in the global variable
// k_TransitionDuration.
//

//
// Standard lerp
//
function StandardLerpTransition_Begin()
{
	this.start = CopyVec2D( this.cur );
	this.t = 0.0;
}
function StandardLerpTransition_Update( target, dt )
{
	// Normalize to get fraction of total
	// transition consumed this frame
	dt /= kTransitionDuration;

	// Advance time.  Transition done?
	this.t += dt;
	if (this.t>=1.0) { this.cur = CopyVec2D(target); return true; }

	// Set new position
	this.cur = LerpVec2D( this.start, target, this.t);
	return false; // Transition not complete
}

//
// Standard smoothstep
//
function StandardSmoothstepTransition_Begin()
{
	this.start = CopyVec2D( this.cur );
	this.t = 0.0;
}
function StandardSmoothstepTransition_Update( target, dt )
{
	// Normalize to get fraction of total
	// transition consumed this frame
	dt /= kTransitionDuration;

	// Advance time.  Transition done?
	this.t += dt;
	if (this.t>=1.0) { this.cur = CopyVec2D(target); return true; }

	// Set new position
	this.cur = LerpVec2D( this.start, target, Smoothstep(this.t) );
	return false; // Transition not complete
}

//
// Stateless lerp
//
function StatelessLerpTransition_Begin()
{
	this.r = 1.0; // 1-t, counts down from 1 to 0
}
function StatelessLerpTransition_Update( target, dt )
{
	// Normalize to get fraction of total
	// transition consumed this frame
	dt /= kTransitionDuration;

	let frac = dt/this.r; // Fraction to consume

	// Subtract timer.  Transition done?
	this.r -= dt;
	if (this.r<=0.0) { this.cur = CopyVec2D(target); return true; }

	// Consume fraction of remaining error
	this.cur.x += (target.x-this.cur.x) * frac;
	this.cur.y += (target.y-this.cur.y) * frac;
	return false; // Transition not complete
}

//
// Stateless smoothstep
//
function StatelessSmoothstepTransition_Begin()
{
	this.t = 0.0;
}
function StatelessSmoothstepTransition_Update( target, dt )
{
	// Normalize to get fraction of total
	// transition consumed this frame
	dt /= kTransitionDuration;

	// Calculate fraction of overall transition that should
	// be remaining, before we step forward
	let old_s_remaining = 1.0 - Smoothstep(this.t);

	// Advance time.  Transition done?
	this.t += dt;
	if (this.t>=1.0) { this.cur = CopyVec2D(target); return true; }

	// Fraction of overall transition that want to remain
	// after we step forward
	let new_s_remaining = 1.0 - Smoothstep(this.t);

	// What fraction of the current error should still remain
	// after we step forward?
	let frac_error_remaining = new_s_remaining/old_s_remaining;

	// Consume enough of the current error to leave the desired
	// proportion remaining.
	let frac = 1.0 - frac_error_remaining;

	// Consume fraction of remaining error
	this.cur.x += (target.x-this.cur.x) * frac;
	this.cur.y += (target.y-this.cur.y) * frac;
	return false; // Transition not complete
}
