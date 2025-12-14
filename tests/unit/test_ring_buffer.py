from app.utils.ringBuffer import RingBuffer

def test_ring_buffer_overflow():
    rb = RingBuffer(size=2)

    rb.push(1)
    rb.push(2)
    rb.push(3)

    assert rb.getAll() == [2, 3]
