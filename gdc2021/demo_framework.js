//
// 2D vector "math library".
//
// I tried to keep this example code as simple as possible.
// 2D vectors are represented as plain Javascript objects with
// x and y attributes.
//

// Return a copy of a 2D vector.
function CopyVec2D( v ) { return { x:v.x, y:v.y } }

// Basic linear interpolation between two 2D vectors.
// The fraction t is not clamped.
function LerpVec2D( a, b, t )
{
	return {
		x: (1-t)*a.x + t*b.x,
		y: (1-t)*a.y + t*b.y
	};
}

//
// Framework for rendering a "game scene" with two carts on a canvas
// and running a simulation.  This is not intended to be as simple
// as possible to make these demos, not something generically useful.
//

// Timescale in our time series graphs
const kHistorySecondWidthPixels = 150;

var g_bPause = false;

class GameWorld {
	constructor( $divContainer )
	{
		this.$divContainer = $divContainer;
		let $canvasScene = $divContainer.find( '#Scene' );
		this.canvasScene =  $canvasScene[0];

		this.canvasPosGraph = $divContainer.find( '#PosGraph' )[0];
		this.canvasVelGraph = $divContainer.find( '#VelGraph' )[0];

		this.blueCart = { cur:{ x:this.canvasScene.width/3, y:this.canvasScene.height/3 }, img: document.getElementById('cart_blue'), color:'rgb(10,10,200)' };
		this.redCart = { cur:{ x:this.canvasScene.width/3, y:this.canvasScene.height*2/3 }, img: document.getElementById('cart_red'), color:'rgb(200,10,10)' };
		this.target = { cur:{ x:this.canvasScene.width*2/3, y:this.canvasScene.height/2 }, img: document.getElementById('target'), color:'rgb(10,10,10)', visible:true };

		this.blueCart.$divControls = this.$divContainer.find('.BlueSettings' );
		this.redCart.$divControls = this.$divContainer.find('.RedSettings' );

		// Initialize timer
		this.SetCurTime();

		// Initialize history
		this.ClearHistory();

		// Get "this" in another variable so we can use closures and
		// not have confusion below about exactly what "this" refers to.
		let world = this;

		// When we click on the canvas
		$( world.canvasScene ).mousedown( function( event ) {
			world.SetTargetPosFromMouseEvent( event );
			world.MouseDown();

			// Bind the mouse move event while we're being dragged.
			$( world.canvasScene ).mousemove( function( event ) {
				world.SetTargetPosFromMouseEvent( event );
			} );
		} ).mouseup( function( event ) {
			// Unbind when we get mouseup
			$( world.canvasScene ).off( "mousemove" );
		} );

		// Ask to call our update method periodically
		window.setInterval( function() {
			let dt = world.CalculateTimeStep();
			if ( g_bPause )
				return;
			world.UpdateWorld( dt )
		}, 16 );
	}

	// Set the target to the current mouse position
	SetTargetPosFromMouseEvent( event )
	{
		const rect = this.canvasScene.getBoundingClientRect();
		this.target.cur.x = event.clientX - rect.left;
		this.target.cur.y = event.clientY - rect.top;
	}

	DrawObj( ctx, obj, opacity )
	{
		if ( !obj.visible )
			return;
		ctx.globalAlpha = opacity;

		let sz = 64; // canvas.width / 10;

		ctx.drawImage( obj.img, obj.cur.x - sz/2, obj.cur.y - sz/2, sz, sz );
		ctx.globalAlpha = 1.0;
	}

	// Render the current state onto the canvas
	Redraw()
	{
		this.DrawScene();
		this.DrawHistory();
	}
	DrawScene()
	{
		let ctx = this.canvasScene.getContext('2d');

		// Clear the canvas
		ctx.fillStyle = 'rgb(255,255,255)';
		ctx.fillRect( 0, 0, this.canvasScene.width, this.canvasScene.height );

		// Draw the target if any cart is active
		if ( this.IsAnyCartActive() )
			this.DrawObj( ctx, this.target, 1 );

		// Draw the carts
		this.DrawObj( ctx, this.redCart, .8 );
		this.DrawObj( ctx, this.blueCart, .8 );
	}

	// Calculate the X coordinate for a given time value
	CalcHistoryTimeX( timeVal )
	{
		return ( timeVal - this.historyStartTime ) * kHistorySecondWidthPixels;
	}

	DrawObjHistory( ctx, obj )
	{
		const h = obj.history;
		if ( !obj.visible || h.length < 2 )
			return;

		ctx.lineWidth = 1;
		ctx.strokeStyle = obj.color;
		ctx.beginPath();
		ctx.moveTo( this.CalcHistoryTimeX( h[0].t ), h[0].y );
		for ( let i = 0 ; i < h.length ; ++i )
			ctx.lineTo( this.CalcHistoryTimeX( h[i].t ), h[i].y );
		ctx.stroke();
	}

	DrawObjVelHistory( ctx, obj )
	{
		const h = obj.history;
		if ( !obj.visible || h.length < 1 )
			return;

		let y0 = this.canvasVelGraph.height - 2;
		let yScale = -.3;

		ctx.lineWidth = 1;
		ctx.strokeStyle = obj.color;
		ctx.beginPath();
		let prevT = h[0].t;
		let prevPos = h[0].y;
		let first = true;
		for ( let i = 1 ; i < h.length ; ++i )
		{
			let t = h[i].t; 
			if ( t > prevT+.001 )
			{
				let pos = h[i].y;
				let v = (pos - prevPos) / (t - prevT);
				let x = this.CalcHistoryTimeX( h[i].t );
				let y = y0 + Math.abs(v)*yScale;
				if ( first )
				{
					ctx.moveTo( x, y );
					first = false;
				}
				else
				{
					ctx.lineTo( x, y );
				}
				prevT = t;
				prevPos = pos;
			}
		}
		if ( !first )
			ctx.stroke();
	}

	ClearHistoryCanvas( ctx, canvas )
	{
		// Clear the canvas
		ctx.fillStyle = 'rgb(255,255,255)';
		ctx.fillRect( 0, 0, canvas.width, canvas.height );

		// Draw grid lines
		ctx.fillStyle = 'rgb(220,220,220)';
		let t = this.historyGridTime;
		while (true)
		{
			let x = this.CalcHistoryTimeX( t );
			if ( x < 0 )
				this.historyGridTime = t; // Advance it for next time
			if ( x > canvas.width )
				break;
			ctx.fillRect( x, 0, 1, canvas.height );
			t += 1;
		}

	}

	DrawHistory()
	{
		// Draw position graph
		{
			let ctx = this.canvasPosGraph.getContext('2d');
			this.ClearHistoryCanvas( ctx, this.canvasPosGraph )


			// Draw history of each object
			this.DrawObjHistory( ctx, this.target );
			this.DrawObjHistory( ctx, this.redCart );
			this.DrawObjHistory( ctx, this.blueCart );
		}

		// Drawvelocuty graph
		{
			let ctx = this.canvasVelGraph.getContext('2d');
			this.ClearHistoryCanvas( ctx, this.canvasVelGraph )

			// Draw history of each object
			this.DrawObjVelHistory( ctx, this.target );
			this.DrawObjVelHistory( ctx, this.redCart );
			this.DrawObjVelHistory( ctx, this.blueCart );
		}
	}

	// Set current global time value
	SetCurTime()
	{
		this.CurTime = Date.now()/1000.0
	}

	// Update current global time and return timestep since the last time we set it
	CalculateTimeStep()
	{
		// Calculate timestep
		let LastTime = this.CurTime;
		this.SetCurTime();
		return this.CurTime - LastTime;
	}

	// Return true if either cart is "active"
	IsAnyCartActive()
	{
		return this.blueCart.active || this.redCart.active;
	}

	// Called when the mouse is pressed, after we update the position of the target.
	// Base class doesn't need to do anything
	MouseDown() {}

	// Clear history on all the objects
	ClearHistory()
	{
		this.target.history = [];
		this.blueCart.history = [];
		this.redCart.history = [];
		this.historyGridTime = this.CurTime;
		this.historyStartTime = this.CurTime;
	}

	UpdateObjectHistory( obj )
	{
		// Trim old history
		let trim_index = 0;
		let h = obj.history;
		while ( trim_index < h.length && h[trim_index].t < this.historyStartTime )
			++trim_index;
		trim_index -= 2;
		if ( trim_index > 0 )
			h.splice( 0, trim_index );

		// Append a new record at the current time
		// (Note we only record the y coord)
		h.push( { y: obj.cur.y, t: this.CurTime } );
	}

	UpdateHistory()
	{

		// Have we started scrolling yet?  How far
		// off the edge to the right is the current time?
		let shiftPixels = this.CalcHistoryTimeX( this.CurTime ) - this.canvasPosGraph.width + 2;
		if ( shiftPixels >= 1 )
		{

			// Advance the starting time by the time needed to just
			// get it back at the edge.
			this.historyStartTime += shiftPixels / kHistorySecondWidthPixels;
		}

		// Trim object histories and append a new record
		// for the current time
		this.UpdateObjectHistory( this.target );
		this.UpdateObjectHistory( this.blueCart );
		this.UpdateObjectHistory( this.redCart );
	}

}

class TimedTransitionsWorld extends GameWorld {
	constructor( $divContainer )
	{
		super( $divContainer )
		this.$DurationSlider = $divContainer.find('#DurationSlider');

		// Initialize
		this.Reset();

		// Get "this" in another variable so we can use closures and
		// not have confusion below about exactly what 'this" refers to.
		let world = this;
		let ResetThisWorld = function() { world.Reset(); }

		// If the method or transition duration is changed, just reset
		// everything.
		this.$DurationSlider.change( ResetThisWorld );
		$divContainer.find( 'select' ).change( ResetThisWorld );
	}

	// We need to start a transition when the mouse is pressed,
	// if one is not already active
	MouseDown()
	{
		if ( !this.IsAnyCartActive() )
			this.BeginTransition();
	}

	// Reset a particular cart to use the given transition method
	ResetCart( cart )
	{
		cart.active = false;

		// Delete a bunch of attributes used by the different methods.
		// This isn't necessary, but it makes sure there is no cross-talk
		// between methods, and if you are look in the debugger you don't
		// see variables for methods other than the selected one.
		delete cart.t;
		delete cart.r;
		delete cart.start;

		cart.visible = true;
		let method = cart.$divControls.find('.MethodSelect option:selected').text();
		switch ( method )
		{
			case 'Standard Lerp':
				cart.Begin = StandardLerpTransition_Begin;
				cart.Update = StandardLerpTransition_Update;
				break;

			case 'Stateless Lerp':
				cart.Begin = StatelessLerpTransition_Begin;
				cart.Update = StatelessLerpTransition_Update;
				break;

			case 'Standard Smoothstep':
				cart.Begin = StandardSmoothstepTransition_Begin;
				cart.Update = StandardSmoothstepTransition_Update;
				break;

			case 'Stateless Smoothstep':
				cart.Begin = StatelessSmoothstepTransition_Begin;
				cart.Update = StatelessSmoothstepTransition_Update;
				break;

			default:
				cart.visible = false;
				cart.Begin = function() { this.active = false; };
				cart.Update = function( target, dt ) { return false; };
				break;
		}
	};

	// Stop everything and reset
	Reset()
	{
		this.SetCurTime();

		let ms = this.$DurationSlider.val() * 100;
		this.$divContainer.find( '#DurationDisplay' ).text( ms + "ms" );
		kTransitionDuration = ms / 1000.0; // Update code assumes transition time is global

		this.ResetCart( this.blueCart );
		this.ResetCart( this.redCart );
		this.ClearHistory();
		this.Redraw();
	}

	// Start a new transition
	BeginTransition()
	{
		this.SetCurTime();
		this.blueCart.active = true;
		this.blueCart.Begin();
		this.redCart.active = true;
		this.redCart.Begin();

		//this.ClearHistory();

		this.Redraw();
	}

	// Called periodically to update the simulation state
	UpdateWorld( dt )
	{

		// Update carts
		if ( this.blueCart.active )
			this.blueCart.active = !this.blueCart.Update( this.target.cur, dt )
		if ( this.redCart.active )
			this.redCart.active = !this.redCart.Update( this.target.cur, dt )

		this.UpdateHistory();

		// Redraw the canvas
		this.Redraw();
	}
};

class ControlSystemsWorld extends GameWorld {
	Test()
	{
		let world = this;
		world.SetCurTime();
		world.target.cur = { x:world.canvasScene.width/2, y:world.canvasScene.height - 35 };
		world.blueCart.Update = undefined;
		world.blueCart.cur = { x:world.canvasScene.width/2, y:world.canvasScene.height - 35 };
		world.ReadCartControls( world.blueCart );
		world.ClearHistory();

		window.setTimeout( function() {
			world.target.cur = { x:world.canvasScene.width/2, y:world.canvasScene.height/3 + 25 };
		}, 250 );
	}

	constructor( $divContainer )
	{
		super( $divContainer )

		let SetupCartControls = function( cart, color )
		{
			let html = '<td>' + color + ' cart:</td>';
			html += '<td class="MethodSelect"><select>';
			if ( color == 'Blue' )
			{
				html += '<option selected="selected">First-Order Lag</option>';
			}
			else
			{
				html += '<option selected="selected">None</option>';
				html += '<option>First-Order Lag</option>';
			}
			html += '<option>PD Controller</option>'
				+ '</select></td>'
				+ '<td>'
					+ '<div class="MethodOptions" data-method="First-Order Lag">'
						+ 'k: <input class="k" size=3 value="2.5">'
						+ ' <abbr title="Half-Life.  (Time to remove 50% of error)">&#955;</abbr>=<span class="half_life"></span>'
						+ ' <abbr title="Time constant.  (Time to remove 36.8% error)">&#964;</abbr>=<span class="time_constant"></span>'
					+ '</div>'
					+ '<div class="MethodOptions" data-method="PD Controller">'
						+ '<abbr title="Damping ratio">Zeta</abbr>: <input class="zeta" size=3 value="1.0">'
						+ ' <abbr title="Natural frequency">Omega</abbr>: <input class="omega" size=3 value="8.0">'
						+ ' k<sub>d</sub>=<span class="k_d"></span>'
						+ ' k<sub>p</sub>=<span class="k_p"></span>'
					+ '</div>'
				+ '</td>'

			cart.$divControls.html( html );

			cart.$fol_k = cart.$divControls.find( ".k" );
			cart.$fol_halflife = cart.$divControls.find( ".half_life" );
			cart.$fol_timeconstant = cart.$divControls.find( ".time_constant" );

			cart.$pd_zeta = cart.$divControls.find( ".zeta" );
			cart.$pd_omega = cart.$divControls.find( ".omega" );
			cart.$pd_k_d = cart.$divControls.find( ".k_d" );
			cart.$pd_k_p = cart.$divControls.find( ".k_p" );

			return html;
		};

		SetupCartControls( this.blueCart, "Blue" );
		SetupCartControls( this.redCart, "Red" );
	}

	// Read all the settings form the DOM elements.
	ReadCartControls( cart )
	{
		cart.visible = true;
		let method = cart.$divControls.find('.MethodSelect option:selected').text();
		switch ( method )
		{
			case 'First-Order Lag':
			
				cart.Update = FirstOrderLag_Update;

				{
					let k = cart.$fol_k.val();
					if ( k >= 0.0 )
						cart.k = k;
					cart.$fol_halflife.text( ( .693 / cart.k ).toFixed(2) );
					cart.$fol_timeconstant.text( ( 1.0 / cart.k ).toFixed(2) );
				}
				break;

			case 'PD Controller':
				if ( cart.Update != PDController_Update )
				{
					cart.Update = PDController_Update;
					cart.vel = { x:0, y:0 };
				}

				{
					let omega = parseFloat( cart.$pd_omega.val() );
					let zeta = parseFloat( cart.$pd_zeta.val() );

					if ( omega >= 0.0 && omega < 100.0 && zeta >= 0.0 && zeta < 100.0 )
					{
						cart.k_p = omega*omega;
						cart.k_d = -2*zeta*omega;
					}
					cart.$pd_k_p.text( cart.k_p.toFixed(2) );
					cart.$pd_k_d.text( cart.k_d.toFixed(2) );
				}
				break;

			default:
				cart.visible = false;
				delete cart.Update; // We should never be called
				break;
		}
		cart.$divControls.find( '.MethodOptions' ).each( function() {
			let $div = $(this);
			let m = $div.attr( 'data-method' );
			if ( m == method )
				$div.show();
			else
				$div.hide();
		} );

		cart.active = cart.visible;
	};

	// Called periodically to update the simulation state
	UpdateWorld( dt )
	{

		// Don't bother trying to detect changes, just always read the controls.
		this.ReadCartControls( this.blueCart );
		this.ReadCartControls( this.redCart );

		// Don't redraw or do anything if we're not active
		if ( !this.IsAnyCartActive() )
			return;

		// Update carts
		if ( this.blueCart.active )
			this.blueCart.Update( this.target.cur, dt )
		if ( this.redCart.active )
			this.redCart.Update( this.target.cur, dt )

		this.UpdateHistory();

		// Redraw the canvas
		this.Redraw();
	}
};
