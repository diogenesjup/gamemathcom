//
// Update methods for control systems
//
// These are written to match the framework from the presentation
// as closely as possible.  They will be invoked on "this", which
// is a plain javascript object in which the current position is
// stored in the attribute "cur".
//

//
// First-Order Lag
//
function FirstOrderLag_Update( target, dt )
{

	// Here we are doing the "correct" thing
	this.cur = LerpVec2D( target, this.cur, Math.exp(-this.k*dt) );
}

//
// PD controller
//
function PDController_Update( target, dt )
{

	// Calculate acceleration
	let acc_x = this.k_p * (target.x-this.cur.x) + this.k_d*this.vel.x;
	let acc_y = this.k_p * (target.y-this.cur.y) + this.k_d*this.vel.y;

	// Step forward in time ("Euler integration")
	this.vel.x += acc_x*dt;
	this.vel.y += acc_y*dt;
	this.cur.x += this.vel.x*dt;
	this.cur.y += this.vel.y*dt;
}

