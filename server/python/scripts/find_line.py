# title: Find line
# description: Drive forward while following a line using the line sensor.

def run(ctx):
    for _ in range(10):
        line = ctx.robot.line()
        if line and line.get("onLine"):
            ctx.log("line detected")
            ctx.robot.led("green")
        else:
            ctx.robot.led("red")
        ctx.robot.forward(5)
        ctx.wait(200)
    ctx.robot.stop()
    ctx.log("done")
